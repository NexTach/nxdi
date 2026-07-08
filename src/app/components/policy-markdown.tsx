"use client";

import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type FormulaItem = {
  label: string;
  expression: string;
};

type FormulaSection = {
  title: string;
  items: FormulaItem[];
};

function parseFormulaBlock(source: string) {
  const lines = source.split(/\r?\n/);
  let title = "배당 배분 공식";
  let description = "";
  const sections: FormulaSection[] = [];
  let currentSection: FormulaSection | null = null;
  let currentItem: FormulaItem | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("title:")) {
      title = trimmedLine.slice("title:".length).trim() || title;
      continue;
    }
    if (trimmedLine.startsWith("description:")) {
      description = trimmedLine.slice("description:".length).trim();
      continue;
    }

    if (!trimmedLine) {
      currentItem = null;
      continue;
    }

    if (trimmedLine.startsWith("# ")) {
      currentSection = {
        title: trimmedLine.slice(2).trim(),
        items: []
      };
      sections.push(currentSection);
      currentItem = null;
      continue;
    }

    if (/^\s+/.test(line) && currentItem) {
      currentItem.expression = `${currentItem.expression} ${trimmedLine}`.trim();
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) continue;

    if (!currentSection) {
      currentSection = {
        title: "공식",
        items: []
      };
      sections.push(currentSection);
    }

    currentItem = {
      label: trimmedLine.slice(0, separatorIndex).trim(),
      expression: trimmedLine.slice(separatorIndex + 1).trim()
    };
    currentSection.items.push(currentItem);
  }

  return {
    title,
    description,
    sections
  };
}

function DividendFormulaBlock({ source }: { source: string }) {
  const formula = parseFormulaBlock(source);

  return (
    <section className="policy-formula-block" aria-label={formula.title}>
      <header>
        <div>
          <p className="policy-formula-eyebrow">산식</p>
          <h3>{formula.title}</h3>
        </div>
        {formula.description ? <p>{formula.description}</p> : null}
      </header>
      <div className="policy-formula-sections">
        {formula.sections.map((section, sectionIndex) => (
          <section className="policy-formula-section" key={section.title}>
            <div className="policy-formula-section-head">
              <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
              <h4>{section.title}</h4>
            </div>
            <div className="policy-formula-equations">
              {section.items.map((item) => (
                <div className="policy-formula-equation" key={`${section.title}-${item.label}`}>
                  <span className="policy-formula-left">{item.label}</span>
                  <span className="policy-formula-equals">=</span>
                  <span className="policy-formula-right">{item.expression}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

type CodeElementProps = {
  className?: string;
  children?: ReactNode;
};

function MarkdownPre({
  children,
  node,
  ...props
}: ComponentPropsWithoutRef<"pre"> & { node?: unknown }) {
  void node;
  const child = Children.toArray(children)[0];

  if (isValidElement<CodeElementProps>(child)) {
    const className = child.props.className ?? "";
    if (className.split(" ").includes("language-dividend-formula")) {
      return <DividendFormulaBlock source={String(child.props.children ?? "")} />;
    }
  }

  return <pre {...props}>{children}</pre>;
}

export function PolicyMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      components={{
        pre: MarkdownPre
      }}
      remarkPlugins={[remarkGfm]}
    >
      {markdown}
    </ReactMarkdown>
  );
}
