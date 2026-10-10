import Nav, { type NavKey } from "./Nav";
import shell from "./shell.module.css";

// Henüz yapılmamış sekmeler için geçici ekran.
export default function Yakinda({
  active,
  title,
  text,
}: {
  active: NavKey;
  title: string;
  text: string;
}) {
  return (
    <div className={shell.screen}>
      <div className={shell.scroll}>
        <h1 className={shell.title}>{title}</h1>
        <div className={shell.empty}>
          <div className={shell.emptyTitle}>Bu ekran sırada</div>
          <div className={shell.emptyText}>{text}</div>
        </div>
      </div>
      <Nav active={active} />
    </div>
  );
}
