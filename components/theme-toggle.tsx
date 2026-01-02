import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './theme-provider';
import { Button } from './ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={theme === 'light' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setTheme('light')}
        className="h-8 w-8 p-0"
        title="Light mode"
      >
        <Sun className="h-4 w-4" />
      </Button>
      <Button
        variant={theme === 'system' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setTheme('system')}
        className="h-8 w-8 p-0"
        title="System theme"
      >
        <Monitor className="h-4 w-4" />
      </Button>
      <Button
        variant={theme === 'dark' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setTheme('dark')}
        className="h-8 w-8 p-0"
        title="Dark mode"
      >
        <Moon className="h-4 w-4" />
      </Button>
    </div>
  );
}
