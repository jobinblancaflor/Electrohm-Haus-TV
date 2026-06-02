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
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">▶</span>
              </div>
              <h1 className="text-xl text-foreground">Electrohm Haus TV</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1 justify-end">
            <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-2 flex-1 max-w-[400px]">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <select
              value={selectedCountry}
              onChange={(e) => onCountryChange(e.target.value)}
              className="bg-muted border-none outline-none text-sm text-foreground p-2 rounded-lg hidden md:block max-w-[120px]"
            >
              <option value="All">All Countries</option>
              {countries.filter(c => c !== 'All').map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>

            <select
              value={selectedCategoryId}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="bg-muted border-none outline-none text-sm text-foreground p-2 rounded-lg hidden md:block max-w-[150px]"
            >
              <option value="All">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>

            <button className="p-2 hover:bg-muted rounded-lg transition-colors">
              <User className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
