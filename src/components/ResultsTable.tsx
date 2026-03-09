import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";  // For date formatting (optional, remove if not needed)

interface ResultsRow {
  date: string | null;
  price_change_pct: number | null;
  open: number | null;
  close: number | null;
  implied_move: number | null;
}

interface ResultsTableProps {
  data: ResultsRow[];  // From analysisData.results (post-backend rename)
}

export function ResultsTable({ data }: ResultsTableProps) {
  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border p-4 text-center text-muted-foreground">
        No results available. Run analysis to see earnings data.
      </div>
    );
  }

  return (
    <div className="rounded-md border flex flex-col h-full">
      <div className="overflow-auto flex-1 min-h-0 scrollbar-dark-blue">
        <table className="w-full text-sm">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
            <TableHead className="text-center">Date</TableHead>
            <TableHead className="text-center">Open (₹)</TableHead>
            <TableHead className="text-center">Close (₹)</TableHead>
            <TableHead className="text-center">Pct Change (%)</TableHead>
            <TableHead className="text-center">Implied Move (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow key={index}>
              {/* Date: Clean string from backend */}
              <TableCell className="text-center">
                {item.date
                  ? format(new Date(item.date), 'MMM dd, yyyy')  // e.g., "Jan 01, 2023"
                  : '-'
                }
              </TableCell>

              {/* Open: 'open' key, safe .toFixed */}
              <TableCell className="text-center">
                {item.open !== null && item.open !== undefined
                  ? `₹${item.open.toFixed(2)}`
                  : '-'
                }
              </TableCell>

              {/* Close: 'close' key */}
              <TableCell className="text-center">
                {item.close !== null && item.close !== undefined
                  ? `₹${item.close.toFixed(2)}`
                  : '-'
                }
              </TableCell>

              {/* Pct Change: Safe access with color */}
              <TableCell
                className={`text-center ${
                  item.price_change_pct && item.price_change_pct >= 0 
                    ? 'text-green-600 font-medium' 
                    : 'text-red-600 font-medium'
                }`}
              >
                {item.price_change_pct !== null && item.price_change_pct !== undefined
                  ? `${item.price_change_pct.toFixed(2)}%`
                  : '-'
                }
              </TableCell >

              {/* Implied Move: 'implied_move' */}
              <TableCell className="text-center">
                {item.implied_move !== null && item.implied_move !== undefined
                  ? `${item.implied_move.toFixed(2)}%`
                  : '-'
                }
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </table>
      </div>
    </div>
  );
}

