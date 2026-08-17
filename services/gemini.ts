function parseHeightToCm(heightStr: string): number {
  try {
    const ftMatch = heightStr.match(/(\d+)\s*ft/);
    const inMatch = heightStr.match(/(\d+)\s*in/);
    const feet = ftMatch ? parseInt(ftMatch[1], 10) : 5;
    const inches = inMatch ? parseInt(inMatch[1], 10) : 9;
    return (feet * 12 + inches) * 2.54;
  } catch {
    return 175;
  }
}

function parseWeightToKg(weightStr: string): number {
  try {
    const match = weightStr.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : 70;
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

  // Hydration: 33ml per kg
  const water = Math.round((weight * 0.033) * 10) / 10;

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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
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

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
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
