import { Header } from './components/Header.js';
import { CampaignAnalyticsTable } from './components/CampaignAnalyticsTable.js';

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <CampaignAnalyticsTable />
      </main>
    </div>
  );
}
