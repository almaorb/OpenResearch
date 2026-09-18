// The Vault tab: the documents a project is built from, kept by the Alma
// editor and indexed so a session's `rag_search` answers from them. A
// repository holds code; the client's brief as a PDF, the spec, a saved API
// page, and the research earlier sessions filed do not fit in it — they go
// here. Everything is relayed through `/api/alma/vault/*` to the editor,
// the same route the session's own tools take, so what is dropped here is
// what the agent finds.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import {
  type Project,
  type VaultDocument,
  type VaultFolder,
  type VaultHit,
  getVaultFolders,
  listVault,
  putVaultDocument,
  reindexVault,
  removeVaultDocument,
  searchVault,
  searchVaultAndCode,
} from "../api";
import { m } from "../paraglide/messages.js";
import { Button, IconButton, Input, Spinner } from "./ui";

/** The vault folder a project's documents go in: its repository's name,
 *  which is also what the editor names it when that repository is open. */
export function vaultFolderOf(project: Project): string {
  const path = project.repoPath || project.path || "";
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || project.slug || project.name;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function indexStatus(doc: VaultDocument): { tone: string; text: string; why?: string } {
  if (!doc.kind) return { tone: "text-subtext", text: m.vault_stored_not_read() };
  if (!doc.indexed) return { tone: "text-accent-amber", text: m.vault_not_indexed() };
  if (doc.indexed.error) return { tone: "text-accent-red", text: m.vault_unreadable(), why: doc.indexed.error };
  if (doc.stale) return { tone: "text-accent-amber", text: m.vault_passages_changed({ count: doc.indexed.chunks }) };
  return { tone: "text-accent-green", text: m.vault_passages({ count: doc.indexed.chunks }) };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(file.name));
    reader.onload = () => {
      // A data: URL is `data:<mime>;base64,<payload>`; only the payload goes.
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function VaultTab({ project }: { project: Project }) {
  const ownFolder = useMemo(() => vaultFolderOf(project), [project]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [stack, setStack] = useState<{ qdrant: boolean; embedder: boolean } | null>(null);
  const [selected, setSelected] = useState<string>(ownFolder);
  const [documents, setDocuments] = useState<VaultDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ tone: string; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [codeToo, setCodeToo] = useState(false);
  const [hits, setHits] = useState<VaultHit[] | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const loadFolders = useCallback(async () => {
    const reply = await getVaultFolders();
    if (!reply.ok) throw new Error(reply.error || m.vault_editor_refused());
    setStack(reply.stack);
    // The project's own folder is listed even before anything is in it, so
    // there is somewhere to drop the first document.
    const names = reply.folders.map((folder) => folder.name);
    const listed = names.includes(ownFolder)
      ? reply.folders
      : [...reply.folders, { name: ownFolder, own: true, documents: 0, stale: 0 }];
    setFolders(listed.map((folder) => ({ ...folder, own: folder.name === ownFolder })));
  }, [ownFolder]);

  const loadDocuments = useCallback(async (folder: string) => {
    const reply = await listVault(folder);
    if (!reply.ok) throw new Error(reply.error || m.vault_editor_refused());
    setDocuments(reply.documents);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      await loadFolders();
      await loadDocuments(selected);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loadDocuments, loadFolders, selected]);

  useEffect(() => { void refresh(); }, [refresh]);

  const note = (tone: string, text: string) => setProgress((rows) => [...rows, { tone, text }]);

  const addFiles = useCallback(async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setBusy(true);
    setError(null);
    setProgress([{ tone: "text-subtext", text: m.vault_adding({ count: list.length, folder: selected }) }]);
    for (const file of list) {
      try {
        const reply = await putVaultDocument(selected, file.name, await fileToBase64(file));
        if (!reply.ok) throw new Error(reply.error || m.vault_editor_refused());
        if (reply.error && !reply.chunks) note("text-accent-amber", `${file.name}: ${m.vault_stored_not_indexed({ why: reply.error })}`);
        else note("text-accent-green", `${file.name}: ${m.vault_passages({ count: reply.chunks })}`);
      } catch (e) {
        note("text-accent-red", `${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(false);
    await refresh();
  }, [refresh, selected]);

  const remove = useCallback(async (name: string) => {
    if (!window.confirm(m.vault_remove_confirm({ name }))) return;
    try {
      const reply = await removeVaultDocument(selected, name);
      if (!reply.ok) throw new Error(reply.error || m.vault_editor_refused());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refresh, selected]);

  const reindex = useCallback(async () => {
    setBusy(true);
    setProgress([{ tone: "text-subtext", text: m.vault_reindexing({ folder: selected }) }]);
    try {
      const reply = await reindexVault(selected);
      if (!reply.ok) throw new Error(reply.error || m.vault_editor_refused());
      setProgress([{ tone: "text-accent-green", text: reply.indexed.length ? m.vault_reindexed({ names: reply.indexed.join(", ") }) : m.vault_nothing_changed() }]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }, [refresh, selected]);

  const search = useCallback(async () => {
    const question = query.trim();
    if (!question) return;
    setHits(null);
    setSearchNote(m.vault_searching());
    try {
      const scope = selected === "shared" ? ["shared"] : ["shared", selected];
      const reply = codeToo ? await searchVaultAndCode(question) : await searchVault(question, scope);
      if (!reply.ok) throw new Error(reply.error || m.vault_editor_refused());
      setHits(reply.hits);
      setSearchNote(reply.hits.length ? m.vault_hits({ count: reply.hits.length }) : (reply.hint || m.vault_nothing_matched()));
    } catch (e) {
      setSearchNote(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [codeToo, query, selected]);

  const stackNote = !stack ? null
    : stack.qdrant && stack.embedder ? m.vault_index_up()
    : m.vault_index_down({ what: [!stack.qdrant && "qdrant", !stack.embedder && "embedder"].filter(Boolean).join(" + ") });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4 text-sm text-text">
      <div className="flex flex-wrap items-center gap-2">
        <Archive size={15} className="shrink-0 text-subtext" />
        <span className="font-medium">{m.app_vault()}</span>
        {stackNote && <span className={`text-menu ${stack?.qdrant && stack?.embedder ? "text-accent-green" : "text-subtext"}`}>{stackNote}</span>}
        <span className="flex-1" />
        <IconButton size="small" data-tip={m.vault_refresh()} aria-label={m.vault_refresh()} onClick={() => void refresh()}><RefreshCw size={14} /></IconButton>
      </div>
      <p className="mt-1 mb-3 text-menu text-subtext">{m.vault_blurb()}</p>
      {error && <div className="mb-3 rounded-md border border-accent-red/40 px-3 py-2 text-accent-red">{error}</div>}

      <div className="mb-2 flex flex-wrap gap-1.5">
        {folders.map((folder) => (
          <Button key={folder.name} size="small" variant={folder.name === selected ? "default" : "ghost"} active={folder.name === selected}
            onClick={() => { setSelected(folder.name); setDocuments(null); void loadDocuments(folder.name).catch((e) => setError(String(e))); }}>
            <span className="font-mono">{folder.name}</span>
            {folder.own && <span className="text-menu uppercase tracking-wide text-primary">{m.vault_project_tag()}</span>}
            <span className="font-mono text-subtext">{folder.documents}</span>
            {folder.stale > 0 && <span className="text-menu text-accent-amber">{m.vault_to_index({ count: folder.stale })}</span>}
          </Button>
        ))}
      </div>

      <div
        className={`rounded-lg border border-dashed px-4 py-5 text-center transition-colors ${dragging ? "border-primary bg-surface" : "border-border"}`}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
      >
        <div className="flex items-center justify-center gap-2">
          <Upload size={15} className="text-subtext" />
          <span>{m.vault_drop_here({ folder: selected })}</span>
          <Button size="small" variant="ghost" className="underline" disabled={busy} onClick={() => picker.current?.click()}>{m.vault_choose_files()}</Button>
          <input ref={picker} type="file" multiple hidden onChange={(e) => { void addFiles(e.currentTarget.files); e.currentTarget.value = ""; }} />
        </div>
        <div className="mt-1 text-menu text-subtext">{m.vault_formats()}</div>
      </div>
      {progress.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5 text-menu">
          {progress.map((row, i) => <div key={i} className={row.tone}>{row.text}</div>)}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <span className="text-menu uppercase tracking-wide text-subtext">{m.vault_documents_in()}</span>
        <span className="font-mono">{selected}</span>
        <span className="flex-1" />
        <Button size="small" disabled={busy} onClick={() => void reindex()}>{m.vault_reindex()}</Button>
      </div>
      {documents === null ? (
        <div className="py-4"><Spinner /></div>
      ) : documents.length === 0 ? (
        <div className="py-3 text-subtext">{m.vault_empty()}</div>
      ) : (
        <table className="mt-1 w-full border-collapse text-sm">
          <thead>
            <tr className="text-start text-menu uppercase tracking-wide text-subtext">
              <th className="py-1.5 pe-2 text-start font-medium">{m.vault_col_name()}</th>
              <th className="py-1.5 pe-2 text-start font-medium">{m.vault_col_read_as()}</th>
              <th className="py-1.5 pe-2 text-start font-medium">{m.vault_col_size()}</th>
              <th className="py-1.5 pe-2 text-start font-medium">{m.vault_col_index()}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const status = indexStatus(doc);
              return (
                <tr key={doc.name} className="border-t border-border/60 align-top">
                  <td className="py-1.5 pe-2 font-mono text-menu break-all">{doc.name}</td>
                  <td className="py-1.5 pe-2 font-mono text-menu text-subtext">{doc.kind ?? "—"}</td>
                  <td className="py-1.5 pe-2 font-mono text-menu text-subtext whitespace-nowrap">{formatBytes(doc.bytes)}</td>
                  <td className="py-1.5 pe-2">
                    <span className={status.tone}>{status.text}</span>
                    {status.why && <span className="block text-menu text-subtext">{status.why}</span>}
                  </td>
                  <td className="py-1 text-end">
                    <IconButton size="small" data-tip={m.vault_remove()} aria-label={m.vault_remove()} onClick={() => void remove(doc.name)}><Trash2 size={13} /></IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <form className="mt-5 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <Search size={15} className="shrink-0 text-subtext" />
        <Input className="flex-1" type="search" value={query} placeholder={m.vault_ask_placeholder()} onChange={(e) => setQuery(e.currentTarget.value)} />
        <label className="flex items-center gap-1.5 whitespace-nowrap text-menu text-subtext">
          <input type="checkbox" checked={codeToo} onChange={(e) => setCodeToo(e.currentTarget.checked)} />
          {m.vault_code_too()}
        </label>
        <Button size="small" type="submit">{m.vault_search()}</Button>
      </form>
      {searchNote && <div className="mt-1.5 text-menu text-subtext">{searchNote}</div>}
      {hits && hits.length > 0 && (
        <ol className="mt-2 flex list-none flex-col gap-2 p-0">
          {hits.map((hit, i) => (
            <li key={i} className="rounded-md border border-border bg-background px-3 py-2">
              <div className="mb-1 flex flex-wrap items-baseline gap-2 text-menu">
                <span className="uppercase tracking-wide text-subtext">{hit.kind}</span>
                <span className="font-mono text-primary">{hit.kind === "code" ? `${hit.path} #${hit.chunk}` : `${hit.folder}/${hit.name} #${hit.chunk}`}</span>
                <span className="ms-auto font-mono text-subtext">{hit.score.toFixed(3)}</span>
              </div>
              <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-sm">{hit.text}</pre>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
