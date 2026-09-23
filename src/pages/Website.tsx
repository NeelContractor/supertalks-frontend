import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { astrologerApi } from "@/lib/api";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { useStore } from "@/store";
import type {
  FieldStyle,
  MySite,
  SiteDocument,
  SiteSectionDoc,
  StoredTemplateData,
  TemplateField,
  TemplateSchema,
  WebsiteTemplate,
} from "@/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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
  Undo2,
  Redo2,
  RotateCcw,
  Check,
  SquareArrowOutUpRight,
  Lock,
  Upload,
  Loader2,
} from "lucide-react"; 

const SITE_ORIGIN = "http://localhost:3002";

const DEVICES = {
  desktop: { label: "Desktop", width: "100%", Icon: Monitor },
  tablet: { label: "Tablet", width: "768px", Icon: Tablet },
  mobile: { label: "Mobile", width: "390px", Icon: Smartphone },
} as const;

// Sections that can never be removed from a live site.
const ESSENTIAL_SECTIONS = new Set(["book", "question"]);

// Human-friendly labels for otherwise cryptic template field keys.
const FIELD_LABELS: Record<string, string> = {
  siteName: "Site Name",
  ctaLabel: "Button Text",
  buttonLabel: "Button Text",
  eyebrow: "Eyebrow",
  quote: "Quote",
  heading: "Heading",
  subtitle: "Subtitle",
  body: "Description",
  question: "Question",
  answer: "Answer",
  title: "Title",
  icon: "Icon",
};

function labelFor(key: string): string {
  const mapped = FIELD_LABELS[key];
  if (mapped) return mapped;
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// Fields that are controlled by the builder itself and never editable inline.
const HIDDEN_FIELD_KEYS = new Set(["ctaLink", "buttonLink", "logoAlt", "imageAlt", "alt"]);

// Fields that must stay fixed for the astrologer (locked everywhere).
const LOCKED_FIELD_KEYS = new Set(["ctaLabel"]);

const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Source Sans 3", "Nunito", "Raleway", "Work Sans", "Quicksand",
  "Rubik", "DM Sans", "Outfit", "Manrope", "Plus Jakarta Sans",
  "Playfair Display", "Merriweather", "Lora", "PT Serif", "Libre Baskerville",
  "Crimson Text", "EB Garamond", "Cormorant Garamond", "Domine", "Spectral",
  "Oswald", "Bebas Neue", "Anton", "Archivo", "Figtree", "Sora", "Space Grotesk",
  "Urbanist", "Albert Sans", "Karla", "Mulish", "Prompt", "Sarabun", "Fira Sans",
  "IBM Plex Sans", "Comfortaa", "Jost", "Cabin", "Hind", "Public Sans", "Josefin Sans",
];

const SIZE_PRESETS = [
  "12px", "13px", "14px", "15px", "16px", "18px", "20px",
  "22px", "24px", "28px", "32px", "36px", "40px", "44px",
  "48px", "56px", "64px", "72px",
];

const PALETTES = [
  {
    name: "Cream",
    panelColor: "#F2DCCF",
    primaryColor: "#232323",
    darkColor: "#33312E",
    backgroundColor: "#FAF3E8",
    swatchLabel: ["Peach", "Black", "Charcoal", "White"],
  },
  {
    name: "Ocean",
    panelColor: "#C9DFEA",
    primaryColor: "#24415E",
    darkColor: "#12202E",
    backgroundColor: "#EBF3F7",
    swatchLabel: ["Blue", "Navy", "Dark navy", "White"],
  },
  {
    name: "Sage",
    panelColor: "#D5E3C4",
    primaryColor: "#33492B",
    darkColor: "#1E2A18",
    backgroundColor: "#EFF4E8",
    swatchLabel: ["Sage", "Dark green", "Forest", "White"],
  },
  {
    name: "Blush",
    panelColor: "#F3D8D3",
    primaryColor: "#771609",
    darkColor: "#253039",
    backgroundColor: "#FBF2F0",
    swatchLabel: ["Dusty rose", "Maroon", "Maroon dark", "White"],
  },
];

type Device = keyof typeof DEVICES;

type ParentMsg =
  | { type: "supertalks:site-data"; site: SiteDocument }
  | { type: "supertalks:select"; sectionId: string | null; fieldKey?: string | null };

function setValueAtPath(target: unknown, path: string, value: unknown): unknown {
  const [head, ...rest] = path.split(".");
  if (!head) return target;
  if (rest.length === 0) {
    if (Array.isArray(target)) {
      const arr = [...target];
      arr[Number(head)] = value;
      return arr;
    }
    return { ...((target as Record<string, unknown>) ?? {}), [head]: value };
  }
  if (Array.isArray(target)) {
    const arr = [...target];
    arr[Number(head)] = setValueAtPath(arr[Number(head)], rest.join("."), value);
    return arr;
  }
  return {
    ...((target as Record<string, unknown>) ?? {}),
    [head]: setValueAtPath(
      (target as Record<string, unknown> | undefined)?.[head],
      rest.join("."),
      value,
    ),
  };
}

function getValueAtPath(target: unknown, path: string): unknown {
  let cur = target;
  for (const part of path.split(".")) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

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
      site.sections.map((s) => [
        s.id,
        {
          props: s.props,
          ...(s.fieldStyles && Object.keys(s.fieldStyles).length > 0
            ? { fieldStyles: s.fieldStyles }
            : {}),
        },
      ]),
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
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([]);
  const [device, setDevice] = useState<Device>("desktop");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [history, setHistory] = useState<SiteDocument[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

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
        const loadSiteResources = useStore.getState().loadSiteResources;
        const { mySite, templates } = await loadSiteResources();
        if (cancelled) return;
        if (!mySite) throw new Error("Failed to load website");
        setSite(mySite.site);
        setSchema(mySite.schema);
        setSlug(mySite.slug);
        setTemplateId(mySite.templateId);
        setTemplateName(mySite.templateName);
        setTemplates(templates.filter((t) => t.id !== mySite.templateId));
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
      const msg = event.data as {
        type?: string;
        sectionId?: string;
        fieldKey?: string;
        value?: string;
        style?: FieldStyle | null;
      } | null;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "supertalks:ready") {
        readyRef.current = true;
        if (siteRef.current) post({ type: "supertalks:site-data", site: siteRef.current });
        post({ type: "supertalks:select", sectionId: selectedRef.current });
      } else if (msg.type === "supertalks:select") {
        setSelected(msg.sectionId ?? "design");
        setActiveFieldKey(msg.sectionId ? (msg.fieldKey ?? null) : null);
      } else if (msg.type === "supertalks:edit") {
        if (!msg.sectionId || !msg.fieldKey) return;
        patchFieldFromPreview(msg.sectionId, msg.fieldKey, msg.value, msg.style);
        setSelected(msg.sectionId);
        setActiveFieldKey(msg.fieldKey);
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
    post({
      type: "supertalks:select",
      sectionId: selected,
      fieldKey: activeFieldKey,
    });
  }, [selected, activeFieldKey, post]);

  const markDirty = useCallback(() => setDirty(true), []);

  const lastHistoryRef = useRef<string>("");
  const historyLockRef = useRef(false);

  // Record the current site state into the undo stack before a mutation.
  const commitHistory = useCallback((s: SiteDocument) => {
    const key = JSON.stringify(s);
    if (historyLockRef.current) return;
    if (key === lastHistoryRef.current) return;
    lastHistoryRef.current = key;
    setHistory((h) => [...h.slice(0, historyIndex + 1), s]);
    setHistoryIndex((i) => i + 1);
  }, [historyIndex]);

  // Rapid edits from the click-to-edit preview shouldn't flood the undo stack.
  const lastFieldEditRef = useRef(0);
  const commitBeforeFieldEdit = useCallback(
    (s: SiteDocument) => {
      const now = Date.now();
      if (now - lastFieldEditRef.current > 800) commitHistory(s);
      lastFieldEditRef.current = now;
    },
    [commitHistory],
  );

  // Apply edits that originate from clicking elements in the preview iframe.
  const patchFieldFromPreview = (
    sectionId: string,
    fieldKey: string,
    value?: string,
    style?: FieldStyle | null,
  ) => {
    setSite((s) => {
      if (!s) return s;
      commitBeforeFieldEdit(s);
      return {
        ...s,
        sections: s.sections.map((sec) => {
          if (sec.id !== sectionId) return sec;
          let next: SiteSectionDoc = sec;
          if (value !== undefined) {
            next = {
              ...next,
              props: setValueAtPath(next.props, fieldKey, value) as Record<string, unknown>,
            };
          }
          if (style !== undefined) {
            const fieldStyles = { ...(next.fieldStyles ?? {}) };
            if (style === null) delete fieldStyles[fieldKey];
            else fieldStyles[fieldKey] = style;
            next = { ...next, fieldStyles };
          }
          return next;
        }),
      };
    });
    markDirty();
  };

  const patchDesign = (key: string, value: string | number) => {
    setSite((s) => {
      if (s) commitHistory(s);
      return s ? { ...s, design: { ...s.design, [key]: value } } : s;
    });
    markDirty();
  };

  const applyPalette = (palette: (typeof PALETTES)[number]) => {
    setSite((s) => {
      if (s) commitHistory(s);
      return s
        ? {
            ...s,
            design: {
              ...s.design,
              panelColor: palette.panelColor,
              primaryColor: palette.primaryColor,
              darkColor: palette.darkColor,
              backgroundColor: palette.backgroundColor,
            },
          }
        : s;
    });
    markDirty();
  };

  const patchSectionProp = (sectionId: string, key: string, value: unknown) => {
    setSite((s) => {
      if (s) commitHistory(s);
      return s
        ? {
            ...s,
            sections: s.sections.map((sec) =>
              sec.id === sectionId
                ? { ...sec, props: { ...sec.props, [key]: value } }
                : sec,
            ),
          }
        : s;
    });
    markDirty();
  };

  const updateItemField = (
    sectionId: string,
    fieldKey: string,
    index: number,
    itemKey: string,
    value: unknown,
  ) => {
    setSite((s) => {
      if (s) commitHistory(s);
      return s
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
        : s;
    });
    markDirty();
  };

  const addArrayItem = (sectionId: string, fieldKey: string) => {
    setSite((s) => {
      if (s) commitHistory(s);
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
    setSite((s) => {
      if (s) commitHistory(s);
      return s
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
        : s;
    });
    markDirty();
  };

  const removeSection = (sectionId: string) => {
    if (ESSENTIAL_SECTIONS.has(sectionId)) return;
    setSite((s) => {
      if (!s) return s;
      const removed = s.sections.find((sec) => sec.id === sectionId);
      if (!removed) return s;
      commitHistory(s);
      return { ...s, sections: s.sections.filter((sec) => sec.id !== sectionId) };
    });
    setSelected((sel) => (sel === sectionId ? "design" : sel));
    setActiveFieldKey((k) => (k && selected === sectionId ? null : k));
    markDirty();
  };

  // Add a section back that exists in the schema but is not currently on the site.
  const addSection = (sectionField: TemplateSchema["sections"][number]) => {
    setSite((s) => {
      if (!s) return s;
      if (s.sections.some((sec) => sec.id === sectionField.id)) return s;
      commitHistory(s);
      return {
        ...s,
        sections: [...s.sections, {
          id: sectionField.id,
          type: sectionField.type,
          name: sectionField.name,
          default: sectionField.default,
          props: defaultsOf(sectionField.props),
        }],
      };
    });
    markDirty();
  };

  const undo = () => {
    if (historyIndex < 0 || !site) return;
    const prev = history[historyIndex];
    if (!prev) return;
    historyLockRef.current = true;
    lastHistoryRef.current = "";
    setSite(prev);
    setHistoryIndex((i) => i - 1);
    setSelected((sel) =>
      prev.sections.some((sec) => sec.id === sel) ? sel : "design",
    );
    markDirty();
    // Release the lock on the next tick so subsequent edits record again.
    setTimeout(() => {
      historyLockRef.current = false;
    }, 0);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1 || !site) return;
    const next = history[historyIndex + 1];
    if (!next) return;
    historyLockRef.current = true;
    lastHistoryRef.current = "";
    setSite(next);
    setHistoryIndex((i) => i + 1);
    setSelected((sel) =>
      next.sections.some((sec) => sec.id === sel) ? sel : "design",
    );
    markDirty();
    setTimeout(() => {
      historyLockRef.current = false;
    }, 0);
  };

  const resetAll = () => {
    if (!schema || !site) return;
    commitHistory(site);
    setSite(docFromSchema(schema));
    setSelected("design");
    setActiveFieldKey(null);
    markDirty();
  };

  const switchTemplate = (template: WebsiteTemplate) => {
    setTemplateId(template.id);
    setTemplateName(template.name);
    setSchema(template.schema);
    setSite(docFromSchema(template.schema));
    setSelected("design");
    setActiveFieldKey(null);
    setHistory([]);
    setHistoryIndex(-1);
    lastHistoryRef.current = "";
    markDirty();
    reloadPreview();
  };

  const handleSave = async () => {
    const currentSite = siteRef.current ?? site;
    if (!currentSite || !schema) return;
    setSaving(true);
    try {
      await astrologerApi.saveTemplateData({
        templateId: templateId || undefined,
        templateData: toStored(currentSite),
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

  const autosave = useCallback(() => {
    // Fire after the current render settles so siteRef.current includes the
    // just-applied patch (image URL) before we persist.
    window.setTimeout(() => {
      void handleSave();
    }, 0);
  }, [handleSave]);

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
  const availableSections = schema.sections.filter(
    (f) => !site.sections.some((sec) => sec.id === f.id),
  );

  return (
    <div className="flex flex-col gap-3 md:h-[calc(100vh-6.5rem)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-background px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2">
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
                    className={`flex h-8 w-8 items-center justify-center rounded ${
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
            <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
              {dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "No changes"}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={undo}
                    disabled={historyIndex < 0}
                    className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Undo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Redo2 className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Redo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <AlertDialog>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will revert all your site customizations to the template&apos;s default
                        values. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={resetAll}>Reset</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <TooltipContent side="bottom">Reset</TooltipContent>
              </Tooltip>
            </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => window.open(`${SITE_ORIGIN}/${slug}`, "_blank")}
          >
            <SquareArrowOutUpRight className="h-4 w-4" />
            Open in new tab
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={handleSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Main 2-pane layout: preview 70% / options 30% */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[7fr_3fr]">
        {/* Preview column: customize pills above the preview */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-lg border bg-background px-3 py-2">
            <OptionPill
              active={selected === "design"}
              onClick={() => {
                setSelected("design");
                setActiveFieldKey(null);
              }}
            >
              <LayoutTemplate className="h-3.5 w-3.5" />
              Site Design
            </OptionPill>
            {site.sections.map((section) => (
              <OptionPill
                key={section.id}
                active={selected === section.id}
                onClick={() => {
                  setSelected(section.id);
                  setActiveFieldKey(null);
                }}
              >
                {section.name}
              </OptionPill>
            ))}
          </div>

          <main className="relative flex h-[55vh] min-h-[420px] min-w-0 flex-1 flex-col items-center justify-center gap-0 overflow-auto rounded-lg border bg-muted/50 p-3 md:h-auto md:min-h-0">
            <div
              className="mx-auto overflow-hidden rounded border bg-white shadow-sm transition-all"
              style={{
                width: deviceInfo.width,
                maxWidth: "100%",
                height: device === "desktop" ? "100%" : "min(100%, 720px)",
              }}
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
        </div>

        {/* Options panel */}
        <aside className="min-h-0 min-w-0 max-h-[45vh] overflow-y-auto rounded-lg border bg-background p-4 md:h-full md:max-h-none">
          <h2 className="mb-3 text-sm font-semibold">
            {selected === "design"
              ? "Site Design"
              : selectedSection?.name ?? "Properties"}
          </h2>
          {selected === "design" ? (
            <DesignTokens
              values={site.design}
              onPatch={patchDesign}
              onApplyPalette={applyPalette}
            />
          ) : selectedSection ? (
            <>
              {activeFieldKey && !ESSENTIAL_SECTIONS.has(selectedSection.id) ? (
                <ElementStylePanel
                  section={selectedSection}
                  fieldKey={activeFieldKey}
                  value={getValueAtPath(selectedSection.props, activeFieldKey)}
                  onValue={(v) => patchFieldFromPreview(selectedSection.id, activeFieldKey, v)}
                  onStyle={(style) => patchFieldFromPreview(selectedSection.id, activeFieldKey, undefined, style)}
                  onClear={() => patchFieldFromPreview(selectedSection.id, activeFieldKey, undefined, null)}
                />
              ) : null}
              <SectionPanel
                key={selectedSection.id}
                section={selectedSection}
                sectionField={schema.sections.find((f) => f.id === selectedSection.id)}
                activeFieldKey={activeFieldKey}
                // onAutosave={autosave}
                onPatch={(key, value) => {
                  setActiveFieldKey(null);
                  patchSectionProp(selectedSection.id, key, value);
                }}
                onItemField={(field, index, key, value) => {
                  setActiveFieldKey(null);
                  updateItemField(selectedSection.id, field, index, key, value);
                }}
                onAddItem={(field) => addArrayItem(selectedSection.id, field)}
                onRemoveItem={(field, index) => removeArrayItem(selectedSection.id, field, index)}
              />
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function OptionPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SectionNavItem({
  active,
  label,
  highlight,
  removable,
  onRemove,
  onClick,
}: {
  active: boolean;
  label: string;
  highlight?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={`group flex w-full items-center rounded-md transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
      >
        {highlight ? <span className="h-2 w-2 shrink-0 rounded-full bg-current" /> : null}
        <span className="truncate">{label}</span>
      </button>
      {removable ? (
        <button
          type="button"
          title={`Remove ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

// ---- Panels ----

function ElementStylePanel({
  section,
  fieldKey,
  value,
  onValue,
  onStyle,
  onClear,
}: {
  section: SiteSectionDoc;
  fieldKey: string;
  value: unknown;
  onValue: (value: string) => void;
  onStyle: (style: FieldStyle | null) => void;
  onClear: () => void;
}) {
  const style = section.fieldStyles?.[fieldKey] ?? {};
  const label = labelFor(fieldKey.split(".").pop() ?? fieldKey);
  const textValue = value != null ? String(value) : "";
  const colorValue = style.color ?? "";
  return (
    <div className="mb-4 rounded-lg border border-primary/30 bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="capitalize">
            {typeof label === "string" ? label.trim().toLowerCase() : label}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" type="button" onClick={onClear}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Text</Label>
          <Input
            type="text"
            value={textValue}
            onChange={(e) => onValue(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Font size</Label>
          <div className="flex items-center gap-2">
            <Select
              value={
                style.fontSize &&
                SIZE_PRESETS.includes(style.fontSize)
                  ? style.fontSize
                  : "inherit"
              }
              onValueChange={(v) =>
                onStyle({ ...style, fontSize: v === "inherit" ? "" : v })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Default</SelectItem>
                {SIZE_PRESETS.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="text"
              className="w-20"
              placeholder="Custom"
              value={style.fontSize ?? ""}
              onChange={(e) => onStyle({ ...style, fontSize: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Font family</Label>
          <Select
            value={style.fontFamily ?? "inherit"}
            onValueChange={(v) =>
              onStyle({ ...style, fontFamily: v === "inherit" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Default</SelectItem>
              <SelectItem value="serif">Serif</SelectItem>
              <SelectItem value="sans">Sans</SelectItem>
              <SelectSeparator />
              {GOOGLE_FONTS.map((font) => (
                <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Text color</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              className="h-9 w-12 p-1"
              value={/^#[0-9a-fA-F]{6}$/.test(colorValue) ? colorValue : "#771609"}
              onChange={(e) => onStyle({ ...style, color: e.target.value })}
            />
            <Input
              type="text"
              value={colorValue}
              onChange={(e) => onStyle({ ...style, color: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Weight</Label>
            <Select
              value={style.fontWeight ?? "inherit"}
              onValueChange={(v) =>
                onStyle({ ...style, fontWeight: v === "inherit" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Default</SelectItem>
                <SelectItem value="400">Normal</SelectItem>
                <SelectItem value="500">Medium</SelectItem>
                <SelectItem value="600">Semibold</SelectItem>
                <SelectItem value="700">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Style</Label>
            <Select
              value={style.fontStyle ?? "inherit"}
              onValueChange={(v) =>
                onStyle({ ...style, fontStyle: v === "inherit" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">Default</SelectItem>
                <SelectItem value="italic">Italic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Text case</Label>
          <Select
            value={style.textTransform ?? "inherit"}
            onValueChange={(v) =>
              onStyle({ ...style, textTransform: v === "inherit" ? "" : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Default</SelectItem>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="uppercase">UPPERCASE</SelectItem>
              <SelectItem value="lowercase">lowercase</SelectItem>
              <SelectItem value="capitalize">Title Case</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="pt-1 text-xs text-muted-foreground">
          Changes apply to "{fieldKey}" element on the page.
        </p>
      </div>
    </div>
  );
}

const FIELD_GROUPS = ["Content", "Layout", "Image", "Style"] as const;
type FieldGroupName = (typeof FIELD_GROUPS)[number];

function fieldGroupName(fieldKey: string, field: TemplateField): FieldGroupName {
  if (field.type === "image") return "Image";
  if (field.type === "color") return "Style";
  const key = fieldKey.toLowerCase();
  const layoutKeys = [
    "align", "height", "width", "layout", "position", "size",
    "direction", "gap", "spacing", "columns", "reverse", "order", "variant",
  ];
  if (layoutKeys.some((s) => key.includes(s))) return "Layout";
  return "Content";
}

function pluralLabel(field: TemplateField, fieldKey: string): string {
  const name = field.itemName || fieldKey;
  return `${name}s`;
}

function SectionPanel({
  section,
  sectionField,
  activeFieldKey,
  // onAutosave,
  onPatch,
  onItemField,
  onAddItem,
  onRemoveItem,
}: {
  section: SiteSectionDoc;
  sectionField: { id: string; props: Record<string, TemplateField> } | undefined;
  activeFieldKey?: string | null;
  // onAutosave: () => void;
  onPatch: (key: string, value: unknown) => void;
  onItemField: (field: string, index: number, key: string, value: unknown) => void;
  onAddItem: (field: string) => void;
  onRemoveItem: (field: string, index: number) => void;
}) {
  const [tab, setTab] = useState<FieldGroupName>("Content");

  const entries = useMemo(
    () => (sectionField ? Object.entries(sectionField.props) : []),
    [sectionField],
  );

  const grouped = useMemo(() => {
    const byGroup = new Map<FieldGroupName, { key: string; field: TemplateField }[]>();
    for (const g of FIELD_GROUPS) byGroup.set(g, []);
    for (const [key, field] of entries) {
      if (HIDDEN_FIELD_KEYS.has(key)) continue;
      byGroup.get(fieldGroupName(key, field))!.push({ key, field });
    }
    return byGroup;
  }, [entries]);

  const tabs = FIELD_GROUPS.filter((g) => (grouped.get(g)?.length ?? 0) > 0);
  const currentTab = tabs.includes(tab) ? tab : (tabs[0] ?? "Content");

  const groupsFor = useCallback(
    (g: FieldGroupName) => {
      const list = grouped.get(g) ?? [];
      const groups: { label: string; entries: { key: string; field: TemplateField }[] }[] = [];
      let scalar: { key: string; field: TemplateField }[] = [];
      for (const item of list) {
        if (item.field.type === "array") {
          if (scalar.length) {
            groups.push({ label: g === "Content" ? "Text" : g, entries: scalar });
            scalar = [];
          }
          groups.push({ label: pluralLabel(item.field, item.key), entries: [item] });
        } else {
          scalar.push(item);
        }
      }
      if (scalar.length) groups.push({ label: g === "Content" ? "Text" : g, entries: scalar });
      return groups;
    },
    [grouped],
  );

  if (!sectionField) return null;

  if (ESSENTIAL_SECTIONS.has(section.id)) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          This section powers bookings and questions on your site, so its content
          is managed automatically and can&apos;t be edited.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tabs.length > 1 ? (
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setTab(g)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors ${
                currentTab === g
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      ) : null}
      {groupsFor(currentTab).map((grp, i) => (
        <div key={i} className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
            {grp.label} group
          </p>
          <div className="space-y-2">
            {grp.entries.map(({ key, field }) => (
              <div
                key={key}
                className={[
                  "rounded-md transition-shadow",
                  activeFieldKey && (activeFieldKey === key || activeFieldKey.startsWith(`${key}.`))
                    ? "ring-2 ring-primary/40"
                    : "",
                ].join(" ")}
              >
                <FieldControl
                  fieldKey={key}
                  field={field}
                  value={section.props[key]}
                  // onAutosave={onAutosave}
                  onPatch={(v) => onPatch(key, v)}
                  onItemField={onItemField}
                  onAddItem={onAddItem}
                  onRemoveItem={onRemoveItem}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageUploadControl({
  onPatch,
  // onAutosave,
  currentUrl,
  compact,
}: {
  onPatch: (url: string) => void;
  // onAutosave?: () => void;
  currentUrl?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageToCloudinary(file);
      onPatch(url);
      toast.success("Image uploaded");
      // onAutosave?.();
    } catch (err) {
      console.error("Image upload error:", err);
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {uploading ? "Uploading..." : "Upload Image"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {compact ? null : typeof currentUrl === "string" && currentUrl ? (
        <span className="truncate text-xs text-muted-foreground" title={currentUrl}>
          {currentUrl}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">No image set.</span>
      )}
    </>
  );
}

function FieldControl({
  fieldKey,
  field,
  value,
  // onAutosave,
  onPatch,
  onItemField,
  onAddItem,
  onRemoveItem,
}: {
  fieldKey: string;
  field: TemplateField;
  value: unknown;
  // onAutosave: () => void;
  onPatch: (value: unknown) => void;
  onItemField?: (field: string, index: number, key: string, value: unknown) => void;
  onAddItem?: (field: string) => void;
  onRemoveItem?: (field: string, index: number) => void;
}) {
  const readonly = LOCKED_FIELD_KEYS.has(fieldKey);
  if (field.type === "array") {
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    const itemProps = field.itemProps ?? {};
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{labelFor(fieldKey)}</Label>
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
                <Label className="text-xs">{labelFor(itemKey)}</Label>
                {itemField.type === "image" ? (
                  <ImageUploadControl
                    compact
                    // onAutosave={onAutosave}
                    currentUrl={
                      typeof item[itemKey] === "string" ? (item[itemKey] as string) : undefined
                    }
                    onPatch={(url) => onItemField?.(fieldKey, index, itemKey, url)}
                  />
                ) : itemField.type === "textarea" ? (
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
      <Label>{labelFor(fieldKey)}</Label>
      {field.type === "image" ? (
        <ImageUploadControl
          // onAutosave={onAutosave}
          currentUrl={typeof value === "string" ? value : undefined}
          onPatch={onPatch}
        />
      ) : field.type === "textarea" ? (
        <div className="space-y-1">
          <Textarea
            rows={4}
            disabled={readonly}
            value={typeof value === "string" ? value : (field.default as string) ?? ""}
            onChange={(e) => onPatch(e.target.value)}
          />
          {typeof field.max === "number" ? (
            <p className="text-right text-xs text-muted-foreground">
              {String(typeof value === "string" ? value : (field.default as string) ?? "").length}/
              {field.max}
            </p>
          ) : null}
        </div>
      ) : field.type === "select" && field.options ? (
        <Select
          value={typeof value === "string" ? value : (field.default as string) ?? ""}
          onValueChange={readonly ? () => {} : (v) => onPatch(v)}
        >
          <SelectTrigger disabled={readonly}>
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
          disabled={readonly}
          value={typeof value === "number" ? value : (field.default as number) ?? 1}
          onChange={(e) => onPatch(parseFloat(e.target.value) || 0)}
        />
      ) : field.type === "color" ? (
        <Input
          type="color"
          className="h-9 w-12 p-1"
          disabled={readonly}
          value={
            typeof value === "string" && /^#/.test(value)
              ? value
              : (field.default as string) ?? "#000000"
          }
          onChange={(e) => onPatch(e.target.value)}
        />
      ) : (
        <Input
          type="text"
          placeholder={labelFor(fieldKey)}
          disabled={readonly}
          value={typeof value === "string" ? value : (field.default as string) ?? ""}
          onChange={(e) => onPatch(e.target.value)}
        />
      )}
      {readonly ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" /> Locked — managed automatically.
        </p>
      ) : null}
    </div>
  );
}

function DesignTokens({
  values,
  onPatch,
  onApplyPalette,
}: {
  values: Record<string, string | number>;
  onPatch: (key: string, value: string | number) => void;
  onApplyPalette: (palette: (typeof PALETTES)[number]) => void;
}) {
  const design = {
    panelColor: String(values.panelColor ?? ""),
    primaryColor: String(values.primaryColor ?? ""),
    darkColor: String(values.darkColor ?? ""),
    backgroundColor: String(values.backgroundColor ?? ""),
  };
  const activePalette = PALETTES.find(
    (pal) =>
      pal.panelColor === design.panelColor &&
      pal.primaryColor === design.primaryColor &&
      pal.darkColor === design.darkColor &&
      pal.backgroundColor === design.backgroundColor,
  )?.name;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
          Start from a palette
        </p>
        <div className="grid grid-cols-4 gap-2">
          {PALETTES.map((pal) => {
            const selected = activePalette === pal.name;
            return (
              <button
                key={pal.name}
                type="button"
                aria-label={`Apply ${pal.name} palette`}
                title={pal.name}
                onClick={() => onApplyPalette(pal)}
                className={`relative overflow-hidden rounded-lg transition-all ${
                  selected
                    ? "ring-2 ring-blue-600 ring-offset-1"
                    : "ring-1 ring-foreground/15 hover:ring-foreground/40"
                }`}
              >
                <div className="h-10 w-full" style={{ backgroundColor: pal.backgroundColor }} />
                <div className="flex h-6 w-full">
                  {[
                    pal.panelColor,
                    pal.primaryColor,
                    pal.darkColor,
                    pal.backgroundColor,
                  ].map((color, i) => (
                    <span
                      key={i}
                      title={pal.swatchLabel[i]}
                      className="h-full flex-1"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                {selected && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
          Colors
        </p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(values)
            .filter(([key]) => key.toLowerCase().includes("color"))
            .map(([key, value]) => (
              <div
                key={key}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5"
              >
                <Input
                  type="color"
                  className="h-8 w-10 shrink-0 p-0.5"
                  title={typeof value === "string" ? value : ""}
                  value={typeof value === "string" && /^#/.test(value) ? value : "#771609"}
                  onChange={(e) => onPatch(key, e.target.value)}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {labelFor(key)}
                </span>
              </div>
            ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
          Fonts
        </p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(values)
            .filter(([key]) => key.toLowerCase().includes("font"))
            .map(([key, value]) => (
              <div key={key} className="space-y-1.5">
                <Label>{labelFor(key)}</Label>
                <Select value={String(value)} onValueChange={(v) => onPatch(key, v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serif">Serif</SelectItem>
                    <SelectItem value="sans">Sans</SelectItem>
                    <SelectSeparator />
                    {GOOGLE_FONTS.map((font) => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}