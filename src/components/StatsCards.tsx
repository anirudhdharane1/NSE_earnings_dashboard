import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, BarChart, Star, Eye, Copy, Check, ChartNetwork } from "lucide-react";
import { toast } from "@/hooks/use-toast";  // Optional for feedback
import React, { useState } from 'react';  // Or just { useState } if React is already imported elsewhere



interface StatsCardsProps {
  data: {
    total_input_dates: number;
    absolute_mean: number | null;
    first_std: number | null;
    second_std: number | null;
    third_std: number | null;
    // New fields (allow undefined for safety)
    average_move: number | null | undefined;
    average_implied_move: number | null | undefined;
    average_abs_valid_moves: number | null | undefined;
    alpha: number | null | undefined;
  };
  ticker: string;
}

const CopyButton = ({ value, isPercentage = true, ariaLabel = "Copy value" }: {
  value: number | null | undefined;
  isPercentage?: boolean;
  ariaLabel?: string;
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyValue = () => {
    let copyText: string;
    
    if (value === null || value === undefined || isNaN(value)) {
      copyText = "0";  // Or "" for empty
    } else {
      copyText = isPercentage ? value.toFixed(2) : value.toString();
    }
    
    navigator.clipboard.writeText(copyText)
      .then(() => {
        setIsCopied(true);  // Trigger tick animation
        setTimeout(() => setIsCopied(false), 2000);  // Revert after 2s
        // Toast removed - no popup confirmation
      })
      .catch((err) => {
        console.error("Copy failed:", err);
        alert(`Manual copy: ${copyText}`);  // Fallback alert remains for errors
      });
  };

  return (
    <button
      type="button"
      onClick={copyValue}
      className="opacity-0 group-hover:opacity-100 absolute bottom-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-all z-10"
      aria-label={ariaLabel}
    >
      {isCopied ? (
        <Check className="h-4 w-4 text-green-500" />  // Green tick during animation
      ) : (
        <Copy className="h-4 w-4" />  // Copy icon (visible on hover)
      )}
    </button>
  );
};

const copyValue = (value: number | null | undefined, isPercentage: boolean = true) => {
  let copyText: string;
  
  if (value === null || value === undefined || isNaN(value)) {
    copyText = "0";  // Copy 0 for N/A (Excel treats as number; change to "" for empty if preferred)
  } else {
    copyText = isPercentage ? value.toFixed(2) : value.toString();  // Raw number, e.g., "2.46" or "17"
  }
  
  navigator.clipboard.writeText(copyText)
    .then(() => {
      toast({
        title: "Copied!",
        description: `Value ${copyText} copied to clipboard. Paste into Excel with Ctrl+V.`,
      });
    })
    .catch((err) => {
      console.error("Copy failed:", err);
      // Fallback: Alert or manual copy
      alert(`Manual copy: ${copyText}`);
    });
};

const formatPct = (value: number | null | undefined): string => {
  if (value == null || value === undefined || isNaN(value)) {
    return "N/A";
  }
  return `${value.toFixed(2)}%`;
};

const getSignColor = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '';  // No color for N/A
  }
  return value >= 0 ? 'text-green-600' : 'text-red-600';
};



export function StatsCards({ data, ticker }: StatsCardsProps) {
  // Fixed: Safer formatPct - handles undefined/null as "N/A", optional chaining for .toFixed
  const formatPct = (value: number | null | undefined): string => {
    if (value == null || value === undefined) {  // Covers null, undefined, NaN
      return "N/A";
    }
    return `${value?.toFixed(2)}%`;  // Optional chaining prevents error if somehow not number
  };

  // Helper for alpha color (green if >=0, red if <0, neutral if null/undefined)
  const getAlphaColor = () => {
    if (data.alpha == null || data.alpha === undefined) return "";
    return data.alpha >= 0 ? "text-green-600" : "text-red-600";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* 1. Total Earnings */}
      <Card className="card-green-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
          <BarChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="relative group pb-8">
          <div className="text-2xl font-bold mb-1">{data.total_input_dates}</div>
          <p className="text-xs text-muted-foreground mb-2">Historical cycles</p>
          <CopyButton 
            value={data.total_input_dates} 
            isPercentage={false} 
            ariaLabel="Copy total earnings" 
          />
        </CardContent>
      </Card>

      {/* 2. Avg Abs Move */}
      <Card className="card-green-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Abs Move</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="relative group pb-8">
          <div className="text-2xl font-bold mb-1">{formatPct(data.absolute_mean)}</div>
          <p className="text-xs text-muted-foreground mb-2">T+1 day after earnings</p>
          <CopyButton 
            value={data.absolute_mean} 
            isPercentage={true} 
            ariaLabel="Copy avg abs move" 
          />
        </CardContent>
      </Card>

      {/* 3. 1σ Threshold */}
      <Card className="card-green-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">1σ Threshold</CardTitle>
          <ChartNetwork className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="relative group pb-8">
          <div className="text-2xl font-bold mb-1">{formatPct(data.first_std)}</div>
          <p className="text-xs text-muted-foreground mb-2">68% of moves</p>
          <CopyButton 
            value={data.first_std} 
            isPercentage={true} 
            ariaLabel="Copy 1σ threshold" 
          />
        </CardContent>
      </Card>

      {/* 4. 2σ Threshold */}
      <Card className="card-green-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">2σ Threshold</CardTitle>
          <ChartNetwork className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="relative group pb-8">
          <div className="text-2xl font-bold mb-1">{formatPct(data.second_std)}</div>
          <p className="text-xs text-muted-foreground mb-2">95% of moves</p>
          <CopyButton 
            value={data.second_std} 
            isPercentage={true} 
            ariaLabel="Copy 2σ threshold" 
          />
        </CardContent>
      </Card>

      {/* 5. Average Move */}
      <Card className="card-green-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Move</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="relative group pb-8">
          <div className={`text-2xl font-bold mb-1 ${getSignColor(data.average_move)}`}>
            {formatPct(data.average_move)}
          </div>
          <p className="text-xs text-muted-foreground mb-2">Signed average change</p>
          <CopyButton 
            value={data.average_move} 
            isPercentage={true} 
            ariaLabel="Copy average move" 
          />
        </CardContent>
      </Card>

      {/* 6. Avg Implied Move */}
      <Card className="card-green-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Implied Move</CardTitle>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="relative group pb-8">
          <div className="text-2xl font-bold mb-1">{formatPct(data.average_implied_move)}</div>
          <p className="text-xs text-muted-foreground mb-2">Options-based expectation</p>
          <CopyButton 
            value={data.average_implied_move} 
            isPercentage={true} 
            ariaLabel="Copy avg implied move" 
          />
        </CardContent>
      </Card>

      {/* 7. Avg Absolute Valid Moves */}
      <Card className="card-green-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Absolute Valid Moves</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="relative group pb-8">
          <div className="text-2xl font-bold mb-1">{formatPct(data.average_abs_valid_moves)}</div>
          <p className="text-xs text-muted-foreground mb-2">Average for valid implied changes</p>
          <CopyButton 
            value={data.average_abs_valid_moves} 
            isPercentage={true} 
            ariaLabel="Copy avg absolute valid moves" 
          />
        </CardContent>
      </Card>

      {/* 8. Alpha */}
      <Card className="card-green-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Alpha</CardTitle>
          <Star className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="relative group pb-8">
          <div className={`text-2xl font-bold mb-1 ${getSignColor(data.alpha)}`}>
            {formatPct(data.alpha)}
          </div>
          <p className="text-xs text-muted-foreground mb-2">Implied move v/s actual move</p>
          <CopyButton 
            value={data.alpha} 
            isPercentage={true} 
            ariaLabel="Copy alpha" 
          />
        </CardContent>
      </Card>
    </div>
  );
}
