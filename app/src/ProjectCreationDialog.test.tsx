// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectCreationDialog } from "./ProjectCreationDialog";

afterEach(cleanup);

const createProps = () => ({
  open: true,
  onClose: vi.fn(),
  onCreateProject: vi.fn(async () => ({ path: "/projects/Keel Demo" })),
  onInitializeGit: vi.fn(async () => undefined),
  onOpenProject: vi.fn(async () => undefined),
  onPickParent: vi.fn(async () => "/projects" as string | null),
});

const fillProject = async (props: ReturnType<typeof createProps>) => {
  fireEvent.click(screen.getByRole("button", { name: "Choose parent folder" }));
  await waitFor(() => expect(props.onPickParent).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
    target: { value: "Keel Demo" },
  });
};

describe("ProjectCreationDialog", () => {
  it("creates, initializes Git, opens the first task, and closes", async () => {
    const props = createProps();
    render(<ProjectCreationDialog {...props} />);
    await fillProject(props);

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(props.onCreateProject).toHaveBeenCalledWith("/projects", "Keel Demo"));
    expect(props.onInitializeGit).toHaveBeenCalledWith("/projects/Keel Demo");
    expect(props.onOpenProject).toHaveBeenCalledWith("/projects/Keel Demo");
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("cancels safely and prevents a second submit while creation is busy", async () => {
    let finishCreation: ((value: { path: string }) => void) | undefined;
    const props = createProps();
    props.onCreateProject.mockImplementation(() => new Promise((resolve) => {
      finishCreation = resolve;
    }));
    render(<ProjectCreationDialog {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalledOnce();
    props.onClose.mockClear();
    await fillProject(props);
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(screen.getByRole("button", { name: "Creating…" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Creating…" }));
    expect(props.onCreateProject).toHaveBeenCalledOnce();
    finishCreation?.({ path: "/projects/Keel Demo" });
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
  });

  it("shows a recoverable creation error and retries without losing the form", async () => {
    const props = createProps();
    props.onCreateProject
      .mockRejectedValueOnce(new Error("Folder permission denied"))
      .mockResolvedValueOnce({ path: "/projects/Keel Demo" });
    render(<ProjectCreationDialog {...props} />);
    await fillProject(props);

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Folder permission denied");
    expect((screen.getByRole("textbox", { name: "Project name" }) as HTMLInputElement).value).toBe("Keel Demo");
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(props.onCreateProject).toHaveBeenCalledTimes(2));
    expect(props.onOpenProject).toHaveBeenCalledWith("/projects/Keel Demo");
  });

  it("keeps a created folder recoverable when Git fails", async () => {
    const props = createProps();
    props.onInitializeGit.mockRejectedValueOnce(new Error("Git is unavailable"));
    render(<ProjectCreationDialog {...props} />);
    await fillProject(props);

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Git is unavailable");
    expect(screen.getByText("/projects/Keel Demo")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry Git initialization" }));
    await waitFor(() => expect(props.onInitializeGit).toHaveBeenCalledTimes(2));
    expect(props.onOpenProject).toHaveBeenCalledWith("/projects/Keel Demo");
  });

  it("can open the created folder without Git after initialization fails", async () => {
    const props = createProps();
    props.onInitializeGit.mockRejectedValueOnce(new Error("Git is unavailable"));
    render(<ProjectCreationDialog {...props} />);
    await fillProject(props);
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    fireEvent.click(await screen.findByRole("button", { name: "Open without Git" }));

    await waitFor(() => expect(props.onOpenProject).toHaveBeenCalledWith("/projects/Keel Demo"));
    expect(props.onInitializeGit).toHaveBeenCalledOnce();
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("skips Git initialization when the option is unchecked", async () => {
    const props = createProps();
    render(<ProjectCreationDialog {...props} />);
    await fillProject(props);
    fireEvent.click(screen.getByRole("checkbox", { name: "Initialize a Git repository" }));

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(props.onOpenProject).toHaveBeenCalledWith("/projects/Keel Demo"));
    expect(props.onInitializeGit).not.toHaveBeenCalled();
  });

  it("retries opening a folder that was already created", async () => {
    const props = createProps();
    props.onOpenProject
      .mockRejectedValueOnce(new Error("Project could not open"))
      .mockResolvedValueOnce(undefined);
    render(<ProjectCreationDialog {...props} />);
    await fillProject(props);
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Project could not open");
    fireEvent.click(screen.getByRole("button", { name: "Retry opening" }));

    await waitFor(() => expect(props.onOpenProject).toHaveBeenCalledTimes(2));
    expect(props.onCreateProject).toHaveBeenCalledOnce();
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
