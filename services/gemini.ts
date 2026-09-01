import * as FileSystem from "expo-file-system/legacy";

function parseHeightToCm(heightStr: string): number {
  try {
    if (!heightStr) return 175;
    const clean = String(heightStr).toLowerCase();
    
    // Check if entered as ft/in (e.g. "5 ft 9 in" or "5'9")
    const ftMatch = clean.match(/(\d+)\s*(ft|'|feet)/);
    const inMatch = clean.match(/(\d+)\s*(in|"|inches)/);
    if (ftMatch) {
      const feet = parseInt(ftMatch[1], 10);
      const inches = inMatch ? parseInt(inMatch[1], 10) : 0;
      return (feet * 12 + inches) * 2.54;
    }

    // Check if entered as cm or numeric
    const match = clean.match(/(\d+(\.\d+)?)/);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 50 && val < 250) return val;
      if (val < 10) return val * 30.48; // e.g. 5.9 ft
    }

    return 175;
  } catch {
    return 175;
  }
}

function parseWeightToKg(weightStr: string): number {
  try {
    if (!weightStr) return 70;
    const clean = String(weightStr).toLowerCase();
    const match = clean.match(/(\d+(\.\d+)?)/);
    if (!match) return 70;
    const val = parseFloat(match[1]);

    if (clean.includes("lb") || clean.includes("lbs")) {
      return val * 0.453592; // lbs to kg
    }
    return val;
  } catch {
    return 70;
  }
}

function calculateAge(yearStr: string): number {
  try {
    const birthYear = parseInt(yearStr, 10);
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  } catch {
    return 25;
  }
}

export function calculateFallbackTargets(
  gender: string,
  goal: string,
  workoutFrequency: string,
  birthYear: string,
  heightStr: string,
  weightStr: string
) {
  const weight = parseWeightToKg(weightStr);
  const heightCm = parseHeightToCm(heightStr);
  const age = calculateAge(birthYear);

  // 1. Calculate BMR (Mifflin-St Jeor)
  let bmr = 0;
  if (gender === "Male") {
    bmr = 10 * weight + 6.25 * heightCm - 5 * age + 5;
  } else if (gender === "Female") {
    bmr = 10 * weight + 6.25 * heightCm - 5 * age - 161;
  } else {
    bmr = 10 * weight + 6.25 * heightCm - 5 * age - 78;
  }

  // 2. Adjust for Activity level (TDEE multiplier)
  let activityMultiplier = 1.2;
  if (workoutFrequency === "2-3 days") {
    activityMultiplier = 1.375;
  } else if (workoutFrequency === "3-4 days") {
    activityMultiplier = 1.55;
  } else if (workoutFrequency === "5-6 days") {
    activityMultiplier = 1.725;
  }
  const tdee = Math.round(bmr * activityMultiplier);

  // 3. Adjust for goal
  let targetCalories = tdee;
  let advice = "";
  if (goal.toLowerCase().includes("lose")) {
    targetCalories = tdee - 500;
    advice = "Your target is set to a healthy calorie deficit (-500 kcal) for fat loss. Focus on high protein foods to preserve muscle, stay hydrated, and pair your calorie limit with consistent resistance training or cardiovascular activity 3-4 days a week.";
  } else if (goal.toLowerCase().includes("gain")) {
    targetCalories = tdee + 500;
    advice = "Your target is set to a calorie surplus (+500 kcal) for muscle hypertrophy. Focus on clean carbohydrate sources, adequate protein, progressive overload in your workouts, and sleeping at least 7-8 hours a night for optimal growth.";
  } else {
    advice = "Your target is set to maintenance. Aim to balance your daily intake, maintain your current activity levels, keep hydration high, and focus on clean, nutrient-dense foods to fuel your daily performance.";
  }

  // Ensure minimum safe calories
  targetCalories = Math.max(gender === "Female" ? 1200 : 1500, targetCalories);

  // 4. Calculate macros
  const protein = Math.round(weight * 2.0);
  const fats = Math.round((targetCalories * 0.25) / 9);
  const carbs = Math.round((targetCalories - (protein * 4) - (fats * 9)) / 4);

  // Hydration calculation based on Institute of Medicine adult standards + activity bonus
  let baseWater = weight * 0.035; // 35ml per kg body weight
  if (workoutFrequency === "2-3 days") {
    baseWater += 0.5;
  } else if (workoutFrequency === "3-4 days") {
    baseWater += 0.75;
  } else if (workoutFrequency === "5-6 days") {
    baseWater += 1.0;
  }

  // Apply gender-specific adult minimum safeguards (Male: 3.5L, Female: 2.7L)
  const minAdultWater = gender === "Female" ? 2.7 : 3.5;
  const water = Math.max(minAdultWater, Math.round(baseWater * 10) / 10);

  return {
    calories: targetCalories,
    protein,
    carbs,
    fats,
    water,
    advice,
    isFallback: true,
  };
}

export async function generateAIFitnessTargets(
  gender: string,
  goal: string,
  workoutFrequency: string,
  birthDate: { day: string; month: string; year: string },
  height: string,
  weight: string
) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";

  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
    console.warn("Gemini API key is not configured. Falling back to local calculations.");
    return calculateFallbackTargets(
      gender,
      goal,
      workoutFrequency,
      birthDate.year,
      height,
      weight
    );
  }

  const age = calculateAge(birthDate.year);
  const prompt = `Act as an elite fitness coach and personal nutritionist.
Calculate the daily calorie and macronutrient requirements for a user with these stats:
- Gender: ${gender}
- Goal: ${goal}
- Workout Frequency: ${workoutFrequency}
- Age: ${age} years (Birth Year: ${birthDate.year})
- Height: ${height}
- Weight: ${weight}

You must return:
1. Daily calories required (in kcal, e.g. 2150)
2. Daily protein required (in grams, e.g. 150)
3. Daily carbs required (in grams, e.g. 210)
4. Daily fats required (in grams, e.g. 70)
5. Daily water required (in Liters, e.g. 3.2)
6. A concise piece of fitness/nutrition advice for this specific profile (max 80 words)

Your output must be strictly in the following JSON structure:
{
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "water": number,
  "advice": "string"
}`;

  try {
    const modelsToTry = [
      "gemini-3.6-flash",
      "gemini-flash-latest",
      "gemini-3.5-flash",
      "gemini-2.5-flash-lite",
    ];

    let data = null;
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        });

        if (response.ok) {
          data = await response.json();
          break;
        } else {
          const errText = await response.text().catch(() => "");
          lastError = new Error(`Model ${model} HTTP ${response.status}: ${errText}`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!data) {
      throw lastError || new Error("All Gemini fitness target models returned error");
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    const parsed = JSON.parse(responseText.trim());
    return {
      calories: Number(parsed.calories),
      protein: Number(parsed.protein),
      carbs: Number(parsed.carbs),
      fats: Number(parsed.fats),
      water: Number(parsed.water),
      advice: String(parsed.advice),
      isFallback: false,
    };
  } catch (error) {
    console.error("Failed to generate targets with Gemini, using fallback:", error);
    return calculateFallbackTargets(
      gender,
      goal,
      workoutFrequency,
      birthDate.year,
      height,
      weight
    );
  }
}

export async function analyzeFoodImage(imageUri: string) {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";

  // Fallback data
  const fallbackResult = {
    foodName: "Grilled Salmon & Avocado Salad",
    servingSize: "1 plate (320g)",
    calories: 420,
    protein: 32,
    carbs: 12,
    fats: 26,
    isFood: true,
    isFallback: true
  };

  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
    console.warn("Gemini API key is not configured in .env. Returning fallback food data.");
    // Simulate realistic processing delay for fallback
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return fallbackResult;
  }

  try {
    // 1. Convert image to base64 using expo-file-system
    let base64Data = "";
    if (imageUri.startsWith("data:")) {
      base64Data = imageUri.split(",")[1];
    } else {
      base64Data = await FileSystem.readAsStringAsync(imageUri, {
        encoding: "base64",
      });
    }

    let mimeType = "image/jpeg";
    if (imageUri.toLowerCase().includes(".png")) {
      mimeType = "image/png";
    } else if (imageUri.toLowerCase().includes(".webp")) {
      mimeType = "image/webp";
    } else if (imageUri.toLowerCase().includes(".heic")) {
      mimeType = "image/heic";
    }

    const modelsToTry = [
      "gemini-3.6-flash",
      "gemini-flash-latest",
      "gemini-3.5-flash",
      "gemini-2.5-flash-lite",
    ];

    const prompt = `Act as an expert AI vision model and nutritionist. Analyze the attached image carefully.

First, determine if the image depicts an edible food item, dish, beverage, ingredient, or meal.
- If it IS edible food/beverage/meal: set "isFood": true. Identify the exact food item name (e.g. "Chicken Curry with Rice", "Pepperoni Pizza"), estimate serving size, and calculate calories, protein, carbs, and fats.
- If it IS NOT an edible food item (e.g. chair, table, shoe, phone, car, laptop, animal, person, furniture, electronic, or non-edible object): set "isFood": false. Identify the detected object name in "foodName" (e.g. "Office Chair", "Laptop", "Sneaker"), set "servingSize" to "N/A", and set calories, protein, carbs, and fats to 0.

You MUST return a JSON object with this exact schema:
{
  "isFood": boolean,
  "foodName": "string",
  "servingSize": "string",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number
}`;

    let data = null;
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const apiResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        });

        if (apiResponse.ok) {
          data = await apiResponse.json();
          break; // Successfully fetched from working model endpoint!
        } else {
          const errText = await apiResponse.text().catch(() => "");
          lastError = new Error(`Model ${model} status ${apiResponse.status}: ${errText}`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!data) {
      if (lastError?.message.includes("400") || lastError?.message.includes("API key not valid")) {
        console.error("Gemini API Key is invalid! Please ensure EXPO_PUBLIC_GEMINI_API_KEY in .env is a valid key starting with 'AIzaSy' from https://aistudio.google.com/app/apikey");
      }
      throw lastError || new Error("All Gemini model endpoints returned error");
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error("Empty response from Gemini API");
    }

    const parsed = JSON.parse(responseText.trim());
    const isFood = parsed.isFood !== false;
    return {
      isFood,
      foodName: String(parsed.foodName || (isFood ? "Scanned Food Item" : "Non-edible Object")),
      servingSize: String(parsed.servingSize || "1 serving"),
      calories: isFood ? Number(parsed.calories || 0) : 0,
      protein: isFood ? Number(parsed.protein || 0) : 0,
      carbs: isFood ? Number(parsed.carbs || 0) : 0,
      fats: isFood ? Number(parsed.fats || 0) : 0,
      isFallback: false,
    };
  } catch (error) {
    console.error("Failed to analyze food image with Gemini, using fallback:", error);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return fallbackResult;
  }
}
