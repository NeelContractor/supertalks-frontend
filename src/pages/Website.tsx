import { useCallback, useEffect, useRef, useState } from "react";
import { astrologerApi, templatesApi } from "@/lib/api";
import type {
  MySite,
  SiteDocument,
  SiteSectionDoc,
  StoredTemplateData,
  TemplateField,
  TemplateSchema,
  WebsiteTemplate,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Eye,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  LayoutTemplate,
} from "lucide-react";

const SITE_ORIGIN = "http://localhost:3002";

const DEVICES = {
  desktop: { label: "Desktop", width: "100%", Icon: Monitor },
  tablet: { label: "Tablet", width: "768px", Icon: Tablet },
  mobile: { label: "Mobile", width: "390px", Icon: Smartphone },
} as const;

type Device = keyof typeof DEVICES;

type ParentMsg =
  | { type: "supertalks:site-data"; site: SiteDocument }
  | { type: "supertalks:select"; sectionId: string | null };

function fieldDefault(field: TemplateField): unknown {
  if (field.type === "array") {
    return Array.isArray(field.default) ? field.default : [];
  }
  if (field.type === "number") {
    return typeof field.default === "number" ? field.default : 1;
  }
  return typeof field.default === "string" ? field.default : "";
}

function defaultsOf(fields: Record<string, TemplateField>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields)) out[key] = fieldDefault(field);
  return out;
}

function docFromSchema(schema: TemplateSchema): SiteDocument {
  const design: Record<string, string | number> = {};
  for (const [key, field] of Object.entries(schema.design)) {
    design[key] = fieldDefault(field) as string | number;
  }
  return {
    design,
    sections: schema.sections.map((s) => ({
      id: s.id,
      type: s.type,
      name: s.name,
      default: s.default,
      props: defaultsOf(s.props),
    })),
  };
}

function toStored(site: SiteDocument): StoredTemplateData {
  return {
    design: site.design,
    sections: Object.fromEntries(
      site.sections.map((s) => [s.id, { props: s.props }]),
    ),
  };
}

export default function WebsitePage() {
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [schema, setSchema] = useState<TemplateSchema | null>(null);
  const [site, setSite] = useState<SiteDocument | null>(null);
  const [selected, setSelected] = useState<string>("design");
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([]);
  const [device, setDevice] = useState<Device>("desktop");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const siteRef = useRef<SiteDocument | null>(null);
  const selectedRef = useRef<string>("design");
  siteRef.current = site;
  selectedRef.current = selected;

  const reloadPreview = useCallback(() => {
    readyRef.current = false;
    setIframeKey((k) => k + 1);
  }, []);

  const post = useCallback((msg: ParentMsg) => {
    const win = iframeRef.current?.contentWindow;
    if (win) win.postMessage(msg, SITE_ORIGIN);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, list] = await Promise.all([
          astrologerApi.getMySite(),
          templatesApi.list().catch(() => ({ templates: [] as WebsiteTemplate[] })),
        ]);
        if (cancelled) return;
        setSite(me.site);
        setSchema(me.schema);
        setSlug(me.slug);
        setTemplateId(me.templateId);
        setTemplateName(me.templateName);
        setTemplates(list.templates.filter((t) => t.id !== me.templateId));
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load website");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Incoming messages from the preview iframe.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== SITE_ORIGIN) return;
      const msg = event.data as { type?: string; sectionId?: string } | null;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "supertalks:ready") {
        readyRef.current = true;
        if (siteRef.current) post({ type: "supertalks:site-data", site: siteRef.current });
        post({ type: "supertalks:select", sectionId: selectedRef.current });
      } else if (msg.type === "supertalks:select") {
        setSelected(msg.sectionId ?? "design");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  // Push live preview updates to the iframe.
  useEffect(() => {
    if (site) post({ type: "supertalks:site-data", site });
  }, [site, post]);

  useEffect(() => {
    post({ type: "supertalks:select", sectionId: selected });
  }, [selected, post]);

  const markDirty = useCallback(() => setDirty(true), []);

  const patchDesign = (key: string, value: string | number) => {
    setSite((s) => (s ? { ...s, design: { ...s.design, [key]: value } } : s));
    markDirty();
  };

  const patchSectionProp = (sectionId: string, key: string, value: unknown) => {
    setSite((s) =>
      s
        ? {
            ...s,
            sections: s.sections.map((sec) =>
              sec.id === sectionId
                ? { ...sec, props: { ...sec.props, [key]: value } }
                : sec,
            ),
          }
        : s,
    );
    markDirty();
  };

  const updateItemField = (
    sectionId: string,
    fieldKey: string,
    index: number,
    itemKey: string,
    value: unknown,
  ) => {
    setSite((s) =>
      s
        ? {
            ...s,
            sections: s.sections.map((sec) => {
              if (sec.id !== sectionId) return sec;
              const items = Array.isArray(sec.props[fieldKey])
                ? (sec.props[fieldKey] as Record<string, unknown>[])
                : [];
              return {
                ...sec,
                props: {
                  ...sec.props,
                  [fieldKey]: items.map((item, i) =>
                    i === index ? { ...item, [itemKey]: value } : item,
                  ),
                },
              };
            }),
          }
        : s,
    );
    markDirty();
  };

  const addArrayItem = (sectionId: string, fieldKey: string) => {
    setSite((s) => {
      if (!s) return s;
      const section = s.sections.find((sec) => sec.id === sectionId);
      const field = schema?.sections.find((f) => f.id === sectionId)?.props[fieldKey];
      if (!section || !field) return s;
      const items = Array.isArray(section.props[fieldKey])
        ? (section.props[fieldKey] as Record<string, unknown>[])
        : [];
      return {
        ...s,
        sections: s.sections.map((sec) =>
          sec.id === sectionId
            ? {
                ...sec,
                props: {
                  ...sec.props,
                  [fieldKey]: [...items, defaultsOf(field.itemProps ?? {})],
                },
              }
            : sec,
        ),
      };
    });
    markDirty();
  };

  const removeArrayItem = (sectionId: string, fieldKey: string, index: number) => {
    setSite((s) =>
      s
        ? {
            ...s,
            sections: s.sections.map((sec) => {
              if (sec.id !== sectionId) return sec;
              const items = Array.isArray(sec.props[fieldKey])
                ? (sec.props[fieldKey] as Record<string, unknown>[])
                : [];
              return {
                ...sec,
                props: {
                  ...sec.props,
                  [fieldKey]: items.filter((_, i) => i !== index),
                },
              };
            }),
          }
        : s,
    );
    markDirty();
  };

  const switchTemplate = (template: WebsiteTemplate) => {
    setTemplateId(template.id);
    setTemplateName(template.name);
    setSchema(template.schema);
    setSite(docFromSchema(template.schema));
    setSelected("design");
    markDirty();
    reloadPreview();
  };

  const handleSave = async () => {
    if (!site || !schema) return;
    setSaving(true);
    try {
      await astrologerApi.saveTemplateData({
        templateId: templateId || undefined,
        templateData: toStored(site),
      });
      setDirty(false);
      setSavedAt(new Date());
      toast.success("Website saved");
      reloadPreview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save website");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!site || !schema) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Customize Website</h1>
        <p className="text-muted-foreground">No website template is available yet.</p>
      </div>
    );
  }

  const deviceInfo = DEVICES[device];
  const selectedSection = selected === "design"
    ? null
    : site.sections.find((sec) => sec.id === selected) ?? null;

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutTemplate className="h-4 w-4 shrink-0 text-muted-foreground" />
          {templates.length > 0 ? (
            <Select value={templateId} onValueChange={(id) => {
              const t = templates.find((x) => x.id === id);
              if (t) switchTemplate(t);
            }}>
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder={templateName} />
              </SelectTrigger>
              <SelectContent>
                {[templateId, ...templates.map((t) => t.id)]
                  .filter((id, i, arr) => arr.indexOf(id) === i)
                  .map((id) => {
                    const t = id === templateId
                      ? { id, name: templateName }
                      : templates.find((x) => x.id === id) ?? { id, name: id };
                    return (
                      <SelectItem key={id} value={id}>
                        {t.name}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-medium">{templateName}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            {(
              Object.keys(DEVICES) as Device[]
            ).map((d) => {
              const { label, Icon } = DEVICES[d];
              return (
                <button
                  key={d}
                  type="button"
                  title={label}
                  onClick={() => setDevice(d)}
                  className={`flex h-7 w-7 items-center justify-center rounded ${
                    device === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "No changes"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => window.open(`${SITE_ORIGIN}/${slug}`, "_blank")}
          >
            <Eye className="h-4 w-4" />
            View Site
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={handleSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Main 3-pane layout */}
      <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr_300px] gap-3">
        {/* Sections list */}
        <aside className="min-h-0 overflow-y-auto rounded-lg border bg-background p-2">
          <SectionNavItem
            active={selected === "design"}
            label="Site Design"
            highlight
            onClick={() => setSelected("design")}
          />
          <div className="my-2 h-px bg-border" />
          <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sections
          </div>
          {site.sections.map((section) => (
            <SectionNavItem
              key={section.id}
              active={selected === section.id}
              label={section.name}
              onClick={() => setSelected(section.id)}
            />
          ))}
        </aside>

        {/* Preview */}
        <main className="relative min-h-0 overflow-auto rounded-lg border bg-muted/50 p-3">
          <div
            className="mx-auto overflow-hidden rounded border bg-white shadow-sm transition-all"
            style={{ width: deviceInfo.width, maxWidth: "100%", height: "100%" }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              title="Website preview"
              src={`${SITE_ORIGIN}/${slug}?edit=1`}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        </main>

        {/* Property panel */}
        <aside className="min-h-0 overflow-y-auto rounded-lg border bg-background p-4">
          <h2 className="mb-3 text-sm font-semibold">
            {selected === "design"
              ? "Site Design"
              : selectedSection?.name ?? "Properties"}
          </h2>
          {selected === "design" ? (
            <DesignTokens values={site.design} onPatch={patchDesign} />
          ) : selectedSection ? (
            <SectionPanel
              section={selectedSection}
              sectionField={schema.sections.find((f) => f.id === selectedSection.id)}
              onPatch={(key, value) => patchSectionProp(selectedSection.id, key, value)}
              onItemField={(field, index, key, value) =>
                updateItemField(selectedSection.id, field, index, key, value)
              }
              onAddItem={(field) => addArrayItem(selectedSection.id, field)}
              onRemoveItem={(field, index) => removeArrayItem(selectedSection.id, field, index)}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SectionNavItem({
  active,
  label,
  highlight,
  onClick,
}: {
  active: boolean;
  label: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent"
      }`}
    >
      {highlight ? <span className="h-2 w-2 rounded-full bg-current" /> : null}
      <span className="truncate">{label}</span>
    </button>
  );
}

// ---- Panels ----

function SectionPanel({
  section,
  sectionField,
  onPatch,
  onItemField,
  onAddItem,
  onRemoveItem,
}: {
  section: SiteSectionDoc;
  sectionField: { id: string; props: Record<string, TemplateField> } | undefined;
  onPatch: (key: string, value: unknown) => void;
  onItemField: (field: string, index: number, key: string, value: unknown) => void;
  onAddItem: (field: string) => void;
  onRemoveItem: (field: string, index: number) => void;
}) {
  return (
    <div className="space-y-4">
      {sectionField
        ? Object.entries(sectionField.props).map(([key, field]) => (
            <FieldControl
              key={key}
              fieldKey={key}
              field={field}
              value={section.props[key]}
              onPatch={(v) => onPatch(key, v)}
              onItemField={onItemField}
              onAddItem={onAddItem}
              onRemoveItem={onRemoveItem}
            />
          ))
        : null}
    </div>
  );
}

function FieldControl({
  fieldKey,
  field,
  value,
  onPatch,
  onItemField,
  onAddItem,
  onRemoveItem,
}: {
  fieldKey: string;
  field: TemplateField;
  value: unknown;
  onPatch: (value: unknown) => void;
  onItemField?: (field: string, index: number, key: string, value: unknown) => void;
  onAddItem?: (field: string) => void;
  onRemoveItem?: (field: string, index: number) => void;
}) {
  if (field.type === "array") {
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    const itemProps = field.itemProps ?? {};
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="capitalize">{fieldKey}</Label>
          <Button
            variant="outline"
            size="icon-sm"
            type="button"
            title={`Add ${field.itemName ?? "item"}`}
            onClick={() => onAddItem?.(fieldKey)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {items.map((item, index) => (
          <div key={index} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {field.itemName ?? "Item"} {index + 1}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                title="Remove"
                onClick={() => onRemoveItem?.(fieldKey, index)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
            {Object.entries(itemProps).map(([itemKey, itemField]) => (
              <div key={itemKey} className="space-y-1.5">
                <Label className="text-xs capitalize">{itemKey}</Label>
                {itemField.type === "textarea" ? (
                  <Textarea
                    rows={3}
                    value={typeof item[itemKey] === "string" ? (item[itemKey] as string) : ""}
                    onChange={(e) => onItemField?.(fieldKey, index, itemKey, e.target.value)}
                  />
                ) : itemField.type === "number" ? (
                  <Input
                    type="number"
                    min={itemField.min}
                    max={itemField.max}
                    step={itemField.step}
                    value={typeof item[itemKey] === "number" ? (item[itemKey] as number) : 0}
                    onChange={(e) =>
                      onItemField?.(fieldKey, index, itemKey, parseFloat(e.target.value) || 0)
                    }
                  />
                ) : (
                  <Input
                    type="text"
                    value={typeof item[itemKey] === "string" ? (item[itemKey] as string) : ""}
                    onChange={(e) => onItemField?.(fieldKey, index, itemKey, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No items yet.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="capitalize">{fieldKey}</Label>
      {field.type === "textarea" ? (
        <Textarea
          rows={4}
          value={typeof value === "string" ? value : (field.default as string) ?? ""}
          onChange={(e) => onPatch(e.target.value)}
        />
      ) : field.type === "select" && field.options ? (
        <Select
          value={typeof value === "string" ? value : (field.default as string) ?? ""}
          onValueChange={(v) => onPatch(v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "number" ? (
        <Input
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={typeof value === "number" ? value : (field.default as number) ?? 1}
          onChange={(e) => onPatch(parseFloat(e.target.value) || 0)}
        />
      ) : field.type === "color" ? (
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-9 w-12 p-1"
            value={
              typeof value === "string" && /^#/.test(value)
                ? value
                : (field.default as string) ?? "#000000"
            }
            onChange={(e) => onPatch(e.target.value)}
          />
          <Input
            type="text"
            value={typeof value === "string" ? value : (field.default as string) ?? ""}
            onChange={(e) => onPatch(e.target.value)}
          />
        </div>
      ) : (
        <Input
          type="text"
          placeholder={fieldKey}
          value={typeof value === "string" ? value : (field.default as string) ?? ""}
          onChange={(e) => onPatch(e.target.value)}
        />
      )}
      {field.type === "image" ? (
        <p className="text-xs text-muted-foreground">Paste an image URL.</p>
      ) : null}
    </div>
  );
}

function DesignTokens({
  values,
  onPatch,
}: {
  values: Record<string, string | number>;
  onPatch: (key: string, value: string | number) => void;
}) {
  return (
    <div className="space-y-4">
      {Object.entries(values).map(([key, value]) => (
        <div key={key} className="space-y-1.5">
          <Label className="capitalize">{key}</Label>
          {key.toLowerCase().includes("font") ? (
            <Select value={String(value)} onValueChange={(v) => onPatch(key, v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="sans">Sans</SelectItem>
              </SelectContent>
            </Select>
          ) : key.toLowerCase().includes("color") ? (
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="h-9 w-12 p-1"
                value={typeof value === "string" && /^#/.test(value) ? value : "#771609"}
                onChange={(e) => onPatch(key, e.target.value)}
              />
              <Input
                type="text"
                value={String(value)}
                onChange={(e) => onPatch(key, e.target.value)}
              />
            </div>
          ) : (
            <Input
              type="text"
              value={String(value)}
              onChange={(e) => onPatch(key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}