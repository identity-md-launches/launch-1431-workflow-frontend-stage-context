import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadConfig } from './config';
import './style.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() { return this.state.error ? <div className="boot-error"><h1>Unable to display the battlefield</h1><p>Reload to restore the interface. Check any pending transaction in your wallet before sending another.</p><button className="button" onClick={() => location.reload()}>Reload page</button></div> : this.props.children; }
}
const root = createRoot(document.getElementById('root')!);
root.render(<div className="boot-error" role="status"><p className="eyebrow">Hive Wars</p><h1>Opening the war room…</h1><p>Loading the attested deployment and contract interfaces.</p></div>);
loadConfig().then(runtime => root.render(<ErrorBoundary><App runtime={runtime} /></ErrorBoundary>)).catch(error => root.render(<div className="boot-error" role="alert"><p className="eyebrow">Hive Wars</p><h1>Deployment unavailable</h1><p>{error instanceof Error ? error.message : 'Reload this page to try again.'}</p><button className="button primary" onClick={() => location.reload()}>Reload page</button></div>));
