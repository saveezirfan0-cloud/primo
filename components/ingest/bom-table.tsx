import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatAud } from "@/lib/utils";
import type { BomSectionView } from "./bom-view";

export function BomTable({ section }: { section: BomSectionView }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[45%]">Item</TableHead>
          <TableHead>Part</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Price each</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Hours</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {section.lines.map((l) => (
          <TableRow key={l.id} className={cn(!l.isLeaf && "bg-muted/40 font-medium")}>
            <TableCell className="whitespace-normal" style={{ paddingLeft: `${8 + l.depth * 18}px` }}>
              <span className={cn(!l.isLeaf && "text-foreground")}>{l.description}</span>
              {l.isExisting && <Badge variant="outline" className="ml-2">OFE</Badge>}
              {l.activity && l.isLeaf && <Badge variant="secondary" className="ml-2">{l.activity}</Badge>}
            </TableCell>
            <TableCell className="font-mono text-xs">{l.code ?? l.partNumber ?? ""}</TableCell>
            <TableCell className="text-right font-mono">{l.qty}</TableCell>
            <TableCell className="text-right font-mono">{l.isLeaf ? formatAud(l.unitPrice) : ""}</TableCell>
            <TableCell className="text-right font-mono">{formatAud(l.total)}</TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {l.hours !== null ? `${l.hours} h` : ""}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="font-medium">
          <TableCell colSpan={4}>Section total (leaves)</TableCell>
          <TableCell className="text-right font-mono">{formatAud(section.leafSum)}</TableCell>
          <TableCell className="text-right font-mono text-muted-foreground">
            {section.total !== null && Math.abs(section.leafSum - section.total) > 0.005 ? `declared ${formatAud(section.total)}` : ""}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
