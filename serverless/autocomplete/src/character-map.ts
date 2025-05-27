// Map of special characters to their ASCII equivalents
export const specialCharacterMap: {[key: string]: string} = {
  // Turkish characters
  'İ': 'I', 'Ö': 'O', 'Ü': 'U', 'Ç': 'C', 'Ş': 'S', 'Ğ': 'G', 
  
  // Latin characters with accents
  'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A', 'Ã': 'A', 'Å': 'A', 'Æ': 'A', 'Ā': 'A',
  'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'Ē': 'E', 'Ė': 'E', 'Ę': 'E',
  'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I', 'Ī': 'I',
  'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Õ': 'O', 'Ø': 'O', 'Ő': 'O', 'Ō': 'O',
  'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ű': 'U', 'Ū': 'U',
  'Ý': 'Y', 'Ÿ': 'Y',
  
  // Spanish/Portuguese characters
  'Ñ': 'N',
  
  // Slavic characters
  'Ć': 'C', 'Č': 'C',
  'Đ': 'D', 'Ď': 'D',
  'Ł': 'L', 'Ľ': 'L',
  'Ń': 'N', 'Ň': 'N',
  'Ŕ': 'R', 'Ř': 'R',
  'Ś': 'S', 'Š': 'S',
  'Ť': 'T',
  'Ź': 'Z', 'Ż': 'Z', 'Ž': 'Z',
  
  // Romanian characters
  'Ș': 'S', 'Ț': 'T',
  
  // Other European characters
  'Þ': 'TH',
  
  // Lowercase versions (for completeness)
  'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a', 'æ': 'a', 'ā': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ė': 'e', 'ę': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i', 'ı': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ø': 'o', 'ő': 'o', 'ō': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ű': 'u', 'ū': 'u',
  'ý': 'y', 'ÿ': 'y',
  'ñ': 'n',
  'ć': 'c', 'č': 'c', 'ç': 'c',
  'đ': 'd', 'ď': 'd',
  'ł': 'l', 'ľ': 'l',
  'ń': 'n', 'ň': 'n',
  'ŕ': 'r', 'ř': 'r',
  'ś': 's', 'š': 's', 'ş': 's', 'ș': 's',
  'ť': 't', 'ț': 't',
  'ź': 'z', 'ż': 'z', 'ž': 'z',
  'þ': 'th',
  'ğ': 'g'
};

// Function to normalize a character using the map
export function normalizeCharacter(char: string): string {
  return specialCharacterMap[char] || char;
}
