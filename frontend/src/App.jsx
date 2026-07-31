import "./App.css";
import { useContext } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Container from "./components/Container";
import Home from "./pages/Home";
import FormPage from "./pages/FormPage";
import UploadFlow from "./pages/UploadFlow";
import CaseStudies from "./pages/CaseStudies";
import CaseStudyDetail from "./pages/CaseStudyDetail";
import { PageProvider } from "./contexts/PageContext";
import { CustomCsProvider } from "./contexts/CustomCsContext";
import { ThemeProvider, ThemeContext } from "./contexts/ThemeContext";
import Results from "./pages/Results";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AppShell() {
  const { theme } = useContext(ThemeContext);

  return (
    <Container>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/form" element={<FormPage />} />
        <Route path="/upload" element={<UploadFlow />} />
        <Route path="/case-studies" element={<CaseStudies />} />
        <Route path="/case-studies/:id" element={<CaseStudyDetail />} />
        <Route path="/results" element={<Results />} />
        <Route path="/results/:id" element={<Results />} />
      </Routes>
      <ToastContainer theme={theme === "dark" ? "dark" : "colored"} />
    </Container>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <PageProvider>
          <CustomCsProvider>
            <AppShell />
          </CustomCsProvider>
        </PageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
