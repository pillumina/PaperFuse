import { FileText, Search } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-papers' | 'no-results';
  filterDescription?: string;
}

export function EmptyState({ type, filterDescription }: EmptyStateProps) {
  if (type === 'no-results') {
    return (
      <div className="text-center py-16 px-4">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
        <h3 className="text-lg font-semibold mb-2">No papers found</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
          No papers match your search query "{filterDescription}"
        </p>
        <div className="text-sm text-muted-foreground">
          Try:
          <ul className="mt-2 space-y-1 inline-block text-left">
            <li>• Using different keywords</li>
            <li>• Checking your spelling</li>
            <li>• Using fewer filters</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <FileText className="w-8 h-8 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-lg font-semibold mb-2">No papers found</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {filterDescription ? (
          <>No papers found matching your filters.</>
        ) : (
          <>No papers available yet. Start by fetching some papers from ArXiv!</>
        )}
      </p>
    </div>
  );
}
