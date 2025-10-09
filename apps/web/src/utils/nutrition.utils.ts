import { NutritionData, NutritionSummary, ParsedAIOutput } from '../types/task.types';

// Calculate calories using the Atwater system: 4 kcal/g for carbs and protein, 9 kcal/g for fat
export function calculateCalories(carbs: number, protein: number, fat: number): number {
  return Math.round(carbs * 4 + protein * 4 + fat * 9);
}

// Calculate the percentage deviation between two values
export function calculateDeviation(actual: number, expected: number): number {
  if (expected === 0) return 0;
  return Math.abs(((actual - expected) / expected) * 100);
}

// Validate nutrition data and calculate totals
export function validateNutrition(nutrition: NutritionData): NutritionSummary & { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Calculate totals from groups
  let totalCalories = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFat = 0;

  nutrition.groups.forEach(group => {
    group.items.forEach(item => {
      totalCalories += item.calories || 0;
      totalCarbs += item.carbs || 0;
      totalProtein += item.protein || 0;
      totalFat += item.fat || 0;
    });
  });

  // Calculate expected calories based on macros
  const calculatedCalories = calculateCalories(totalCarbs, totalProtein, totalFat);
  
  // Calculate deviation
  const calorieDeviation = calculateDeviation(totalCalories, calculatedCalories);

  // Check for warnings
  if (calorieDeviation > 10) {
    warnings.push(`Calorie deviation is ${calorieDeviation.toFixed(1)}% (expected ${calculatedCalories} kcal based on macros)`);
  }

  if (totalCalories === 0) {
    warnings.push('Total calories cannot be zero');
  }

  if (totalCarbs < 0 || totalProtein < 0 || totalFat < 0) {
    warnings.push('Macronutrients cannot be negative');
  }

  const result = {
    calories: totalCalories,
    carbs: totalCarbs,
    protein: totalProtein,
    fat: totalFat,
    calculated_calories: calculatedCalories,
    calorie_deviation: calorieDeviation,
    isValid: warnings.length === 0,
    warnings,
  };

  return result;
}

// Parse AI output to extract structured data
export function parseAIOutput(rawOutput: string): ParsedAIOutput {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(rawOutput);
    
    // Extract nutrition data if present
    let nutrition: NutritionData | undefined;
    if (parsed.nutrition) {
      nutrition = {
        groups: parsed.nutrition.groups || [],
        total: parsed.nutrition.total || {
          calories: 0,
          carbs: 0,
          protein: 0,
          fat: 0,
        },
      };
    }

    return {
      classification: parsed.classification || parsed.type,
      confidence: parsed.confidence || parsed.ai_confidence,
      nutrition,
      detected_items: parsed.detected_items || parsed.items || [],
      warnings: parsed.warnings || [],
      ...parsed,
    };
  } catch (error) {
    // If JSON parsing fails, return minimal structure
    return {
      classification: undefined,
      confidence: undefined,
      warnings: ['Failed to parse AI output as JSON'],
    };
  }
}

// Format nutrition data for human-readable display
export function formatNutritionDisplay(nutrition: NutritionData): string[] {
  const lines: string[] = [];
  
  nutrition.groups.forEach(group => {
    lines.push(`**${group.name}:**`);
    group.items.forEach(item => {
      lines.push(`  • ${item.name}: ${item.amount}${item.unit}`);
      lines.push(`    Calories: ${item.calories} kcal`);
      lines.push(`    Carbs: ${item.carbs}g, Protein: ${item.protein}g, Fat: ${item.fat}g`);
    });
    lines.push('');
  });

  const validation = validateNutrition(nutrition);
  lines.push('**Total Nutrition:**');
  lines.push(`  • Calories: ${validation.calories} kcal`);
  lines.push(`  • Carbohydrates: ${validation.carbs}g`);
  lines.push(`  • Protein: ${validation.protein}g`);
  lines.push(`  • Fat: ${validation.fat}g`);
  
  if (validation.calculated_calories) {
    lines.push(`  • Calculated: ${validation.calculated_calories} kcal (4C+4P+9F)`);
    if (validation.calorie_deviation && validation.calorie_deviation > 10) {
      lines.push(`  • ⚠️ Deviation: ${validation.calorie_deviation.toFixed(1)}%`);
    }
  }

  return lines;
}

// Format general AI output for human-readable display
export function formatAIOutputDisplay(parsed: ParsedAIOutput): string[] {
  const lines: string[] = [];

  if (parsed.classification) {
    lines.push(`**Classification:** ${parsed.classification}`);
  }

  if (parsed.confidence !== undefined) {
    lines.push(`**Confidence:** ${(parsed.confidence * 100).toFixed(1)}%`);
  }

  if (parsed.detected_items && parsed.detected_items.length > 0) {
    lines.push('');
    lines.push('**Detected Items:**');
    parsed.detected_items.forEach((item: string) => {
      lines.push(`  • ${item}`);
    });
  }

  if (parsed.nutrition) {
    lines.push('');
    lines.push(...formatNutritionDisplay(parsed.nutrition));
  }

  if (parsed.warnings && parsed.warnings.length > 0) {
    lines.push('');
    lines.push('**Warnings:**');
    parsed.warnings.forEach((warning: string) => {
      lines.push(`  ⚠️ ${warning}`);
    });
  }

  // Add any other fields that might be present
  const excludedKeys = ['classification', 'confidence', 'detected_items', 'nutrition', 'warnings'];
  Object.keys(parsed).forEach(key => {
    if (!excludedKeys.includes(key) && parsed[key] !== undefined && parsed[key] !== null) {
      lines.push('');
      lines.push(`**${key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}:**`);
      if (typeof parsed[key] === 'object') {
        lines.push(`  ${JSON.stringify(parsed[key], null, 2)}`);
      } else {
        lines.push(`  ${parsed[key]}`);
      }
    }
  });

  return lines;
}