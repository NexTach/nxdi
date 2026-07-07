import type { CSSProperties, ElementType, FormHTMLAttributes, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type WithChildren = {
  children: ReactNode;
  className?: string;
};

export type CompositionChartItem = {
  id: string;
  label: string;
  description?: string;
  value: number;
  color?: string;
  href?: string;
};

type CssVars = CSSProperties & Record<"--tds-chart-color", string>;

const compositionChartPalette = [
  "var(--tds-chart-1)",
  "var(--tds-chart-2)",
  "var(--tds-chart-3)",
  "var(--tds-chart-4)",
  "var(--tds-chart-5)",
  "var(--tds-chart-6)",
  "var(--tds-chart-7)",
  "var(--tds-chart-8)"
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatTdsNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatTdsPercent(value: number) {
  return `${formatTdsNumber(value * 100)}%`;
}

export function AppShell({ children, className }: WithChildren) {
  return <main className={cx("shell", className)}>{children}</main>;
}

export function Navigation({
  title,
  description,
  actions,
  mark = "T"
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  mark?: string;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">{mark}</div>
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="nav-actions">{actions}</div> : null}
    </header>
  );
}

export function Top({
  title,
  description,
  actions,
  id,
  className,
  backLink
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
  backLink?: {
    href: string;
    label?: string;
  };
}) {
  return (
    <section className={cx("hero-band", className)} id={id}>
      {backLink ? (
        <Link className="hero-back-link" href={backLink.href}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{backLink.label ?? "돌아가기"}</span>
        </Link>
      ) : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="hero-actions">{actions}</div> : null}
    </section>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary"
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link className={cx("button", variant === "secondary" && "secondary")} href={href}>
      {children}
    </Link>
  );
}

export function TextLink({
  href,
  children,
  className
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link className={cx("tds-text-link", className)} href={href}>
      {children}
    </Link>
  );
}

export function SectionHeader({
  title,
  description,
  id
}: {
  title: string;
  description?: ReactNode;
  id?: string;
}) {
  return (
    <div className="section-title" id={id}>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

export function Grid({
  columns = 1,
  children,
  className
}: WithChildren & {
  columns?: 1 | 2 | 3 | 4;
}) {
  const columnClass = columns === 1 ? "one" : columns === 2 ? "two" : columns === 3 ? "three" : "four";
  return <section className={cx("grid", columnClass, className)}>{children}</section>;
}

export function Panel({ children, className }: WithChildren) {
  return <section className={cx("panel", className)}>{children}</section>;
}

export function CtaPanel({ children, className }: WithChildren) {
  return <section className={cx("cta-panel", className)}>{children}</section>;
}

export function Metric({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Form({
  children,
  className,
  compact,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  compact?: boolean;
}) {
  return (
    <form className={cx("form", compact && "compact", className)} {...props}>
      {children}
    </form>
  );
}

export function Field({
  label,
  htmlFor,
  wide,
  children
}: {
  label: ReactNode;
  htmlFor: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cx("field", wide && "wide")}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

export function InlineFields({
  children,
  variant
}: {
  children: ReactNode;
  variant?: "exchange" | "holding" | "dividend";
}) {
  return <div className={cx("inline-fields", variant)}>{children}</div>;
}

export function CheckboxField({ children }: { children: ReactNode }) {
  return <label className="checkbox">{children}</label>;
}

export function ComputedValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="computed-rate">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function List({ children, className, id }: WithChildren & { id?: string }) {
  return (
    <section className={cx("list", className)} id={id}>
      {children}
    </section>
  );
}

export function ListRow({
  title,
  description,
  value,
  children
}: {
  title: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="list-row">
      <div>
        <p className="list-row-title">{title}</p>
        {description ? <p className="list-row-sub">{description}</p> : null}
        {children}
      </div>
      {value ? <div className="list-row-value">{value}</div> : null}
    </div>
  );
}

export function RowMeta({ children }: { children: ReactNode }) {
  return <p className="list-row-sub">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Notice({ children, className }: WithChildren) {
  return <div className={cx("notice", className)}>{children}</div>;
}

export function Badge({
  children,
  tone
}: {
  children: ReactNode;
  tone: "pending" | "accepted" | "rejected";
}) {
  return <span className={cx("badge", tone)}>{children}</span>;
}

export function MutedText({
  as,
  children,
  className
}: WithChildren & {
  as?: ElementType;
}) {
  const Component = as ?? "span";
  return <Component className={cx("tds-muted", className)}>{children}</Component>;
}

export function TableSurface({ children, className }: WithChildren) {
  return <div className={cx("table-wrap", className)}>{children}</div>;
}

export function Stack({ children, className }: WithChildren) {
  return <div className={cx("stack", className)}>{children}</div>;
}

export function CompositionChart({
  items,
  label,
  emptyText = "데이터 없음",
  className
}: {
  items: CompositionChartItem[];
  label: string;
  emptyText?: string;
  className?: string;
}) {
  const visibleItems = items.filter((item) => item.value > 0);
  const total = visibleItems.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0 || visibleItems.length === 0) {
    return <div className={cx("tds-composition-chart", "empty-chart", className)}>{emptyText}</div>;
  }

  const size = 168;
  const center = size / 2;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const chartItems = visibleItems.map((item, index) => {
    const ratio = item.value / total;
    const dashLength = ratio * circumference;
    const color = item.color ?? compositionChartPalette[index % compositionChartPalette.length];
    const chartItem = {
      ...item,
      color,
      dashLength,
      dashOffset: -offset,
      ratio
    };
    offset += dashLength;
    return chartItem;
  });

  return (
    <div className={cx("tds-composition-chart", className)} aria-label={label}>
      <div className="tds-composition-visual">
        <svg role="img" viewBox={`0 0 ${size} ${size}`}>
          <circle className="tds-composition-track" cx={center} cy={center} r={radius} />
          {chartItems.map((item) => (
            item.href ? (
              <a
                aria-label={`${item.label} 상세 보기`}
                className="tds-composition-slice-link"
                href={item.href}
                key={item.id}
              >
                <circle
                  className="tds-composition-slice"
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={item.color}
                  strokeDasharray={`${item.dashLength} ${circumference - item.dashLength}`}
                  strokeDashoffset={item.dashOffset}
                >
                  <title>{`${item.label} ${formatTdsPercent(item.ratio)}`}</title>
                </circle>
              </a>
            ) : (
              <circle
                className="tds-composition-slice"
                cx={center}
                cy={center}
                key={item.id}
                r={radius}
                stroke={item.color}
                strokeDasharray={`${item.dashLength} ${circumference - item.dashLength}`}
                strokeDashoffset={item.dashOffset}
              >
                <title>{`${item.label} ${formatTdsPercent(item.ratio)}`}</title>
              </circle>
            )
          ))}
        </svg>
      </div>
      <div className="tds-composition-legend">
        {chartItems.map((item) => {
          const content = (
            <>
              <span
                className="tds-composition-dot"
                style={{ "--tds-chart-color": item.color } as CssVars}
              />
              <div>
                <strong>{item.label}</strong>
                {item.description ? <span>{item.description}</span> : null}
              </div>
              <em>{formatTdsPercent(item.ratio)}</em>
            </>
          );

          return item.href ? (
            <Link className="tds-composition-legend-row clickable" href={item.href} key={item.id}>
              {content}
            </Link>
          ) : (
            <div className="tds-composition-legend-row" key={item.id}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
