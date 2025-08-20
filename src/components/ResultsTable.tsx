import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "lucide-react";

interface ResultsTableProps {
  data: Array<{
    date: string;
    price_change_pct: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
  }>;
}

export function ResultsTable({ data }: ResultsTableProps) {
  const [showAll, setShowAll] = useState(false);

  // Sort data by date descending (newest first)
  const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Data to display, either all rows or only first 18
  const displayedData = showAll ? sortedData : sortedData.slice(0, 18);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Historical Earnings Moves
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Price Change (%)</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">High</TableHead>
              <TableHead className="text-right">Low</TableHead>
              <TableHead className="text-right">Close</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedData.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">
                  {new Date(item.date).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {item.price_change_pct !== null ? (
                    <span className={
                      item.price_change_pct > 0 ? "text-green-600" :
                      item.price_change_pct < 0 ? "text-red-600" : ""
                    }>
                      {item.price_change_pct > 0 ? "+" : ""}
                      {item.price_change_pct.toFixed(2)}%
                    </span>
                  ) : "N/A"}
                </TableCell>
                <TableCell className="text-right">{item.open !== null ? item.open.toFixed(2) : "N/A"}</TableCell>
                <TableCell className="text-right">{item.high !== null ? item.high.toFixed(2) : "N/A"}</TableCell>
                <TableCell className="text-right">{item.low !== null ? item.low.toFixed(2) : "N/A"}</TableCell>
                <TableCell className="text-right">{item.close !== null ? item.close.toFixed(2) : "N/A"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {sortedData.length > 18 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-primary hover:underline focus:outline-none"
            >
              {showAll ? "Show Less" : `Show More (${sortedData.length - 18} more)`}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
