import React from 'react';
import {
  Wrench,
  Sprout,
  Dog,
  GraduationCap,
  Laptop,
  ShoppingBag,
  Layers,
  Sparkles
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-5 h-5' }) => {
  switch (name) {
    case 'Wrench':
      return <Wrench className={className} />;
    case 'Sprout':
      return <Sprout className={className} />;
    case 'Dog':
      return <Dog className={className} />;
    case 'GraduationCap':
      return <GraduationCap className={className} />;
    case 'Laptop':
      return <Laptop className={className} />;
    case 'ShoppingBag':
      return <ShoppingBag className={className} />;
    case 'Layers':
      return <Layers className={className} />;
    default:
      return <Sparkles className={className} />;
  }
};
