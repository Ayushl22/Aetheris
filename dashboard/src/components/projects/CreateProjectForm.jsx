import { useState } from "react";

export default function CreateProjectForm({ onCreate, loading }) {
  const [name, setName] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    const ok = await onCreate(name.trim());
    if (ok) setName("");
  };

  return (
    <form className="inline-create" onSubmit={submit}>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New project name"
        maxLength={100}
      />
      <button className="primary-button" disabled={loading}>
        {loading ? "Creating..." : "Create project"}
      </button>
    </form>
  );
}