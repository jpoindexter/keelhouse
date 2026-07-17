import { describe, expect, it, vi } from "vitest";
import { createProjectEntryActions, PROJECT_ENTRY_LABELS } from "./projectEntryActions";

const createDependencies = (activeProject: string | null = "/repo") => ({
  beginCreateProject: vi.fn(async () => true),
  createTask: vi.fn(async () => true),
  getActiveProject: vi.fn(() => activeProject),
  openProjectEntry: vi.fn(async () => true),
  openProjectPicker: vi.fn(async () => true),
  switchProjectPath: vi.fn(async () => true),
});

describe("createProjectEntryActions", () => {
  it("owns the product labels used by every project entry surface", () => {
    expect(PROJECT_ENTRY_LABELS).toEqual({
      newProject: "New Project…",
      newTask: "New Task",
      openProject: "Open Project…",
      switchProject: "Switch Project…",
    });
  });

  it("routes project creation, opening, and switching through supplied lifecycles", async () => {
    const dependencies = createDependencies();
    const actions = createProjectEntryActions(dependencies);

    await actions.newProject();
    await actions.openProject();
    await actions.chooseProject();
    await actions.switchProject("/other");

    expect(dependencies.beginCreateProject).toHaveBeenCalledOnce();
    expect(dependencies.openProjectPicker).toHaveBeenCalledOnce();
    expect(dependencies.openProjectEntry).toHaveBeenCalledOnce();
    expect(dependencies.switchProjectPath).toHaveBeenCalledWith("/other");
  });

  it("reports project creation unavailable until the real creation flow is supplied", async () => {
    const dependencies = { ...createDependencies(), beginCreateProject: undefined };

    const result = await createProjectEntryActions(dependencies).newProject();

    expect(result).toBe(false);
  });

  it("creates a task in the active project", async () => {
    const dependencies = createDependencies();
    const actions = createProjectEntryActions(dependencies);

    const result = await actions.newTask();

    expect(result).toBe(true);
    expect(dependencies.createTask).toHaveBeenCalledWith("/repo");
    expect(dependencies.openProjectPicker).not.toHaveBeenCalled();
  });

  it("opens project entry when New Task has no active project", async () => {
    const dependencies = createDependencies(null);
    const actions = createProjectEntryActions(dependencies);

    const result = await actions.newTask();

    expect(result).toBe(false);
    expect(dependencies.createTask).not.toHaveBeenCalled();
    expect(dependencies.openProjectEntry).toHaveBeenCalledOnce();
    expect(dependencies.openProjectPicker).not.toHaveBeenCalled();
  });

  it("prevents duplicate task creation while the first request is in flight", async () => {
    let finish: ((value: boolean) => void) | undefined;
    const dependencies = createDependencies();
    dependencies.createTask.mockImplementation(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const actions = createProjectEntryActions(dependencies);

    const first = actions.newTask();
    const second = actions.newTask();

    expect(await second).toBe(false);
    expect(dependencies.createTask).toHaveBeenCalledOnce();
    finish?.(true);
    expect(await first).toBe(true);
  });
});
