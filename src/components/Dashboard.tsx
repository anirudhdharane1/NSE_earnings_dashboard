import { useState } from "react";
import { TrendingUp, Download, Cherry, Vegan, RollerCoaster, Radical, PiSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatsCards } from "./StatsCards";
import { ResultsTable } from "./ResultsTable";
import { ChartDisplay } from "./ChartDisplay";
import { HistogramChart } from "./HistogramChart";
import UploadBox from "./UploadBox";
import { toast } from "@/hooks/use-toast";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function Dashboard() {
  // uploadedFile state is now an array of Files or null
  const [ticker, setTicker] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (files: File[]) => {
    setUploadedFile(prev =>
      prev && prev.length > 0
        ? [...prev, ...files.filter(f => !prev.some(prevFile => prevFile.name === f.name && prevFile.size === f.size))]
        : files
    );
    setUploadError(null);
  };

  // Remove a file by index
  const handleRemoveFile = (idx: number) => {
    if (!uploadedFile) return;
    const newFiles = uploadedFile.filter((_, index) => index !== idx);
    setUploadedFile(newFiles.length > 0 ? newFiles : null);
  };

  const handleAnalysis = async () => {
    if (!ticker) {
      toast({
        title: "Missing information",
        description: "Please enter a ticker symbol",
        variant: "destructive",
      });
      return;
    }
    setIsProcessing(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      if (uploadedFile && uploadedFile.length > 0) {
        uploadedFile.forEach(file => {
          formData.append("images", file);
        });
      }
      formData.append("ticker", ticker);
      const response = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        let errorMessage = `Analysis failed: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Keep default status message when response body is not JSON.
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setAnalysisData(data);
      const inputSourceText = data?.input_source === "opstra" ? "Opstra" : "OCR fallback";
      toast({
        title: "Analysis complete",
        description: `Earnings impact analysis generated using ${inputSourceText}`,
      });
    } catch (error: any) {
      console.error("Analysis error:", error);
      setUploadError(error?.message || "Analysis failed");
      toast({
        title: "Analysis failed",
        description: "Please check your connection and try again",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toFixedOrZero = (value: number | null | undefined, digits = 2): string => {
    if (value == null || Number.isNaN(value)) return (0).toFixed(digits);
    return value.toFixed(digits);
  };

  const copyDetailsRow = async () => {
    if (!analysisData?.stats) return;

    const stats = analysisData.stats;

    // Excel-friendly TSV row:
    // (1) ticker, (2) blank, (3) avg abs move, (4) avg implied move,
    // (5) 1st SD, (6) 2nd SD, (7) alpha
    const row = [
      ticker,
      "",
      toFixedOrZero(stats.absolute_mean),
      toFixedOrZero(stats.average_implied_move),
      toFixedOrZero(stats.first_std),
      toFixedOrZero(stats.second_std),
      toFixedOrZero(stats.alpha),
    ].join("\t");

    try {
      await navigator.clipboard.writeText(row);
      toast({
        title: "Copied",
        description: "Row copied. Paste into Excel (Ctrl+V).",
      });
    } catch (err) {
      console.error("Copy failed:", err);
      toast({
        title: "Copy failed",
        description: "Clipboard access was blocked by the browser.",
        variant: "destructive",
      });
    }
  };

  // Export CSV functionality
  const exportCSV = () => {
    if (!analysisData?.results) return;
    const headers = ['Date', 'Price Change (%)', 'Open', 'High', 'Low', 'Close'];
    const rows = analysisData.results.map(row => [
      row.date,
      row.price_change_pct !== null ? row.price_change_pct.toFixed(2) : '',
      row.open !== null ? row.open.toFixed(2) : '',
      row.high !== null ? row.high.toFixed(2) : '',
      row.low !== null ? row.low.toFixed(2) : '',
      row.close !== null ? row.close.toFixed(2) : '',
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${ticker}_earnings_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Excel functionality
  const exportExcel = () => {
    if (!analysisData?.results) return;
    const worksheetData = [
      ['Date', 'Price Change (%)', 'Open', 'High', 'Low', 'Close'],
      ...analysisData.results.map(row => [
        row.date,
        row.price_change_pct !== null ? row.price_change_pct.toFixed(2) : '',
        row.open !== null ? row.open.toFixed(2) : '',
        row.high !== null ? row.high.toFixed(2) : '',
        row.low !== null ? row.low.toFixed(2) : '',
        row.close !== null ? row.close.toFixed(2) : '',
      ])
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Earnings Data");
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, `${ticker}_earnings_data.xlsx`);
  };

  const handleDownload = (format: "csv" | "excel") => {
    toast({
      title: "Download started",
      description: `Downloading data as ${format.toUpperCase()}`,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-8 py-16">
          <h1 className="text-6xl font-bold text-foreground flex items-center justify-center gap-4">
            <PiSquare className="w-16 h-16 text-primary" />
           PiNaccle Labs
          </h1>
          <p className="text-xl text-muted-foreground">
            Analyze historical earnings impact on stock price movements
          </p>
        </div>
        {/* Input Section */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="card-green-shadow">
            <CardHeader>
              <CardTitle>Stock Symbol</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ticker">NSE Ticker Symbol</Label>
                <Input
                  id="ticker"
                  type="text"
                  placeholder="e.g., TCS"
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  className="mt-2"
                />
              </div>
              <Button
                onClick={handleAnalysis}
                disabled={isProcessing || !ticker}
                className="w-full"
              >
                {isProcessing ? "Processing..." : "Run Analysis"}
              </Button>

              <Button
                type="button"
                onClick={copyDetailsRow}
                className="w-full"
              >
                Copy details
              </Button>
            </CardContent>
          </Card>
          <Card className="card-green-shadow">
            <CardHeader>
              <CardTitle>Upload Earnings Data</CardTitle>
            </CardHeader>
               <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                Dates/times are fetched from Opstra by ticker first. Upload screenshots only as fallback if needed. You can source earnings dates at {" "}
                <a
                href="https://opstra.definedge.com/results-calendar"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                this website
                </a>.
                </p>

                <UploadBox
                onFileUpload={handleFileUpload}
                uploadedFile={uploadedFile}
                isProcessing={isProcessing}
                onRemoveFile={handleRemoveFile}
                />

                {uploadError && (
                <div className="mt-4 text-sm text-destructive">{uploadError}</div>
            )}
            </CardContent>
          </Card>
        </div>
        {/* Results Section */}
        {analysisData && (
          <>
            <StatsCards data={analysisData.stats} ticker={ticker} />
            {/* Responsive results layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column: Results Table — absolute so charts column sets row height */}
              <div className="lg:relative min-h-[400px]">
                <div className="lg:absolute lg:inset-0">
                  <ResultsTable data={analysisData.results} />
                </div>
              </div>
              {/* Right column: ChartDisplay over HistogramChart */}
              <div className="flex flex-col gap-6">
                <ChartDisplay
                  data={analysisData.results.map(item => ({
                    date: item.date,
                    move: item.price_change_pct || 0,
                    direction: (item.price_change_pct || 0) >= 0 ? "up" : "down",
                  }))}
                  ticker={ticker}
                />
                <HistogramChart
                  data={analysisData.results}
                  ticker={ticker}
                  stats={analysisData.stats}
                />
              </div>
            </div>
            {/* Download Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Export Data
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button
                  variant="outline"
                  onClick={exportCSV}
                >
                  Download CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={exportExcel}
                >
                  Download Excel
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

