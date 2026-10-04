import { Link, useLocation } from "react-router-dom";
import { useNavItems } from "@/lib/nav-items";

/**
 * Below the md breakpoint the header cannot fit the wordmark, five nav links
 * and the bell/avatar/signout cluster in one 320-375px row, so the links move
 * here instead. `md:hidden` keeps the two navigations mutually exclusive.
 */
export function MobileNav() {
  const navItems = useNavItems();
  const location = useLocation();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.to);
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${active ? "stroke-[2.5]" : ""}`}
                />
                <span className="max-w-full truncate leading-none">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}