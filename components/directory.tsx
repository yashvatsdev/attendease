"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, ArrowUpRight } from "lucide-react";
import {
  api,
  useData,
  Modal,
  Confirm,
  ErrorMessage,
  Loading,
  Empty,
  SearchInput,
} from "./ui";
import type { Student, Subject } from "@/lib/types";
type Item = Student & Subject;
export function Directory({ kind }: { kind: "students" | "subjects" }) {
  const student = kind === "students";
  const singular = student ? "student" : "subject";
  const { data, error, reload } = useData<Item[]>(kind);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [details, setDetails] = useState<number | null>(null);
  const filtered = data?.filter((v) =>
    `${v.name} ${student ? v.roll_no : v.code}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {student ? "THE PEOPLE BEHIND THE NUMBERS" : "BUILD YOUR CLASSROOM"}
          </div>
          <h1>
            {student ? "Your students" : "Your subjects"}
            <span className="green">.</span>
          </h1>
          <p>
            {student
              ? "One place for student records and subject enrollments."
              : "Organize subjects and bring the right students together."}
          </p>
        </div>
        <button className="button" onClick={() => setEditing({})}>
          <Plus size={17} />
          Add {singular}
        </button>
      </div>
      <ErrorMessage message={error} />
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>
              All {kind}{" "}
              {data && <span className="inline-count">{data.length}</span>}
            </h2>
            <p>
              {student
                ? "Keep your class list up to date."
                : "Manage subject details and enrollments."}
            </p>
          </div>
          <SearchInput value={search} onChange={setSearch} />
        </div>
        {!data && !error ? (
          <Loading />
        ) : filtered?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{student ? "Student" : "Subject"}</th>
                  <th>{student ? "Roll number" : "Code"}</th>
                  <th>{student ? "Email" : "Enrolled students"}</th>
                  <th>{student ? "Subjects" : "Details"}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar">
                          {v.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <div>
                          <strong>{v.name}</strong>
                          {student && (
                            <small>Added {v.created_at?.slice(0, 10)}</small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="code">
                        {student ? v.roll_no : v.code}
                      </span>
                    </td>
                    <td>
                      {student
                        ? v.email || "—"
                        : `${v.enrollment_count} students`}
                    </td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => setDetails(v.id)}
                      >
                        {student
                          ? `${v.enrollment_count} subjects`
                          : "View students"}
                        <ArrowUpRight size={14} />
                      </button>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${v.name}`}
                          onClick={() => setEditing(v)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button delete"
                          aria-label={`Delete ${v.name}`}
                          onClick={() => setDeleting(v)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            {search
              ? "No matching records."
              : `No ${kind} yet. Add your first ${singular} to get started.`}
          </Empty>
        )}
      </section>
      {editing && (
        <EditForm
          kind={kind}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {deleting && (
        <Confirm
          title={`Delete ${singular}?`}
          message={`Delete ${deleting.name}? This also permanently deletes related enrollments and ${student ? "attendance records" : "class sessions and attendance records"}.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(`${kind}/${deleting.id}`, "DELETE");
            reload();
          }}
        />
      )}
      {details && (
        <Details
          kind={kind}
          id={details}
          onClose={() => {
            setDetails(null);
            reload();
          }}
        />
      )}
    </>
  );
}
function EditForm({
  kind,
  item,
  onClose,
  onSaved,
}: {
  kind: string;
  item: Partial<Item>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const student = kind === "students";
  return (
    <Modal
      title={`${item.id ? "Edit" : "Add"} ${student ? "student" : "subject"}`}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const values = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api(
              kind + (item.id ? `/${item.id}` : ""),
              item.id ? "PUT" : "POST",
              values,
            );
            onSaved();
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {student ? "Roll number" : "Subject code"}
          <input
            required
            name={student ? "roll_no" : "code"}
            maxLength={20}
            defaultValue={student ? item.roll_no : item.code}
            autoFocus
          />
        </label>
        <label>
          {student ? "Full name" : "Subject name"}
          <input
            required
            name="name"
            minLength={2}
            maxLength={100}
            defaultValue={item.name}
          />
        </label>
        {student && (
          <label>
            Email (optional)
            <input
              name="email"
              type="email"
              maxLength={150}
              defaultValue={item.email || ""}
            />
          </label>
        )}
        <ErrorMessage message={error} />
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Details({
  kind,
  id,
  onClose,
}: {
  kind: string;
  id: number;
  onClose: () => void;
}) {
  const { data, error, reload } = useData<Item & { related: Item[] }>(
    `${kind}/${id}`,
  );
  const [mutationError, setMutationError] = useState("");
  const [busy, setBusy] = useState(false);
  const student = kind === "students";
  return (
    <Modal title={data?.name || "Enrollment details"} onClose={onClose}>
      <ErrorMessage message={error || mutationError} />
      {!data && !error && <Loading />}
      {data && (
        <>
          <p className="detail-meta">
            {student ? data.roll_no : data.code}
            {student && data.email ? ` · ${data.email}` : ""}
          </p>
          <h3>{student ? "Subject enrollments" : "Student enrollments"}</h3>
          <p>
            Select who belongs in this classroom. Existing attendance history is
            kept when unenrolling.
          </p>
          <div className="enrollment-list">
            {data.related.length ? (
              data.related.map((v) => (
                <label className="enrollment-row" key={v.id}>
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={Boolean(v.enrolled)}
                    onChange={async (e) => {
                      setBusy(true);
                      setMutationError("");
                      try {
                        await api(
                          "enrollments",
                          e.target.checked ? "POST" : "DELETE",
                          {
                            student_id: student ? id : v.id,
                            subject_id: student ? v.id : id,
                          },
                        );
                        reload();
                      } catch (e) {
                        setMutationError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  <span>
                    <strong>{v.name}</strong>
                    <small>{student ? v.code : v.roll_no}</small>
                  </span>
                  <span className="badge">
                    {v.enrolled ? "Enrolled" : "Not enrolled"}
                  </span>
                </label>
              ))
            ) : (
              <Empty>Add {student ? "subjects" : "students"} first.</Empty>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
