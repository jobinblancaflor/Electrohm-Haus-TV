import { Search, User, Menu } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  countries: string[];
  selectedCountry: string;
  onCountryChange: (country: string) => void;
  categories: { id: string; name: string }[];
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
}

export function Header({ 
  searchQuery, 
  onSearchChange, 
  countries, 
  selectedCountry, 
  onCountryChange,
  categories,
  selectedCategoryId,
  onCategoryChange
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 md:h-16 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => window.location.reload()}>
            <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-base md:text-lg font-bold">▶</span>
            </div>
            <h1 className="text-base md:text-xl font-bold text-foreground hidden xs:block">Electrohm Haus TV</h1>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5 md:px-4 md:py-2 border border-border focus-within:border-primary transition-colors">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-transparent border-none outline-none text-xs md:text-sm w-full text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Filters Desktop & User */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2">
              <select
                value={selectedCountry}
                onChange={(e) => onCountryChange(e.target.value)}
                className="bg-muted text-xs text-foreground p-2 rounded-lg border-none outline-none cursor-pointer hover:bg-muted/80"
              >
                <option value="All">All Countries</option>
                {countries.filter(c => c !== 'All').map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>

              <select
                value={selectedCategoryId}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="bg-muted text-xs text-foreground p-2 rounded-lg border-none outline-none cursor-pointer hover:bg-muted/80"
              >
                <option value="All">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            <button className="w-10 h-10 flex items-center justify-center hover:bg-muted rounded-full transition-colors shrink-0">
              <User className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Mobile Filters Row */}
        <div className="lg:hidden flex items-center gap-2 pb-2 md:pb-3 overflow-x-auto no-scrollbar">
          <select
            value={selectedCountry}
            onChange={(e) => onCountryChange(e.target.value)}
            className="bg-muted text-[11px] md:text-[12px] text-foreground px-3 py-1 rounded-full border border-border outline-none whitespace-nowrap min-w-fit"
          >
            <option value="All">Countries</option>
            {countries.filter(c => c !== 'All').map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>

          <select
            value={selectedCategoryId}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="bg-muted text-[11px] md:text-[12px] text-foreground px-3 py-1 rounded-full border border-border outline-none whitespace-nowrap min-w-fit"
          >
            <option value="All">Categories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
