import styles from "./field-references.module.css";

export type FieldReference = {
  id: string;
  title: string;
  description: string;
  context: string;
  period: string;
  attribution: "TR1 PHARMA" | "Expérience professionnelle personnelle d’Amir";
  verified: true;
  publicationApproved: true;
};

/** Supply only documented, approved references. No public placeholder when empty. */
export function FieldReferences({ items }: { items: readonly FieldReference[] }) {
  const approved = items.filter((item) => item.verified && item.publicationApproved);
  if (!approved.length) return null;
  return (
    <section aria-labelledby="references-title" className={styles.section}>
      <h2 id="references-title">Sur le terrain.</h2>
      {approved.map((item) => (
        <article key={item.id}>
          <p>{item.attribution} · {item.period}</p>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <p>{item.context}</p>
        </article>
      ))}
    </section>
  );
}
