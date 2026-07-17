import { AppWorkbenchView } from "./AppWorkbenchView";
import { useAppRuntime } from "./useAppRuntime";
import "./App.css";
import "./composerModelPicker.css";
import "./responsive-shell.css";
import "./workbenchTransitions.css";

function App() {
  return <AppWorkbenchView {...useAppRuntime()} />;
}

export default App;
