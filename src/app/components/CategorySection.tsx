import { ChevronRight } from 'lucide-react';

interface CategorySectionProps {
  title: string;
  children: React.ReactNode;
  onViewAll?: () => void;
}

export function CategorySection({ title, children, onViewAll }: CategorySectionProps) {
  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl text-foreground">{title}</h2>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {children}
        </div>
      </div>
    </section>
  );
}
