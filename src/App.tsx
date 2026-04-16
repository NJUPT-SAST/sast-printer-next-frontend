import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthChecker from './components/AuthChecker';
import { LanguageProvider } from './lib/i18n';
import LanguageSwitcher from './components/LanguageSwitcher';
import { UiProvider } from './components/UiProvider';
import Header from './components/Header';
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import Printers from './pages/Printers';
import Scanner from './pages/Scanner';

export default function App() {
  return (
    <Router>
      <LanguageProvider>
        <UiProvider>
          <AuthChecker>
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/printers" element={<Printers />} />
                <Route path="/scanner" element={<Scanner />} />
              </Routes>
            </main>
            <LanguageSwitcher />
          </AuthChecker>
        </UiProvider>
      </LanguageProvider>
    </Router>
  );
}