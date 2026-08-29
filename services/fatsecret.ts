import CryptoJS from "crypto-js";

const CLIENT_ID = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET;

// RFC 3986 Percent encoding conforming strictly to OAuth 1.0 requirements
const percentEncode = (str: string): string => {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%7E/g, "~");
};

// High-fidelity fallback database for common searches
const MOCK_FOODS = [
  { food_name: "White Bread", food_description: "Per 1 slice - Calories: 75kcal | Fat: 1g | Carbs: 15g | Protein: 2g" },
  { food_name: "Whole Wheat Bread", food_description: "Per 1 slice - Calories: 80kcal | Fat: 1g | Carbs: 14g | Protein: 4g" },
  { food_name: "Garlic Bread", food_description: "Per 1 slice - Calories: 150kcal | Fat: 7g | Carbs: 18g | Protein: 3g" },
  { food_name: "Butter Toast", food_description: "Per 1 slice - Calories: 120kcal | Fat: 6g | Carbs: 15g | Protein: 2.2g" },
  { food_name: "French Toast", food_description: "Per 1 slice - Calories: 149kcal | Fat: 7g | Carbs: 16g | Protein: 5.1g" },
  { food_name: "Avocado Toast", food_description: "Per 1 slice - Calories: 190kcal | Fat: 11g | Carbs: 20g | Protein: 4.5g" },
  { food_name: "Apple", food_description: "Per 1 medium - Calories: 95kcal | Fat: 0.3g | Carbs: 25g | Protein: 0.5g" },
  { food_name: "Banana", food_description: "Per 1 medium - Calories: 105kcal | Fat: 0.4g | Carbs: 27g | Protein: 1.3g" },
  { food_name: "Orange", food_description: "Per 1 medium - Calories: 62kcal | Fat: 0.2g | Carbs: 15.4g | Protein: 1.2g" },
  { food_name: "Strawberry", food_description: "Per 1 cup - Calories: 46kcal | Fat: 0.4g | Carbs: 11.1g | Protein: 1g" },
  { food_name: "Chicken Breast", food_description: "Per 100g - Calories: 165kcal | Fat: 3.6g | Carbs: 0g | Protein: 31g" },
  { food_name: "Chicken Nuggets", food_description: "Per 5 pieces - Calories: 280kcal | Fat: 18g | Carbs: 16g | Protein: 14g" },
  { food_name: "Grilled Chicken Salad", food_description: "Per 1 bowl - Calories: 320kcal | Fat: 12g | Carbs: 10g | Protein: 35g" },
  { food_name: "Boiled Egg", food_description: "Per 1 large - Calories: 78kcal | Fat: 5g | Carbs: 0.6g | Protein: 6g" },
  { food_name: "Scrambled Eggs", food_description: "Per 2 large eggs - Calories: 180kcal | Fat: 14g | Carbs: 1.5g | Protein: 12g" },
  { food_name: "Egg Sandwich", food_description: "Per 1 sandwich - Calories: 350kcal | Fat: 16g | Carbs: 29g | Protein: 18g" },
  { food_name: "White Rice", food_description: "Per 1 cup - Calories: 205kcal | Fat: 0.4g | Carbs: 45g | Protein: 4.2g" },
  { food_name: "Brown Rice", food_description: "Per 1 cup - Calories: 215kcal | Fat: 1.8g | Carbs: 45g | Protein: 5g" },
  { food_name: "Whole Milk", food_description: "Per 1 glass (240ml) - Calories: 149kcal | Fat: 8g | Carbs: 12g | Protein: 8g" },
  { food_name: "Skimmed Milk", food_description: "Per 1 glass (240ml) - Calories: 83kcal | Fat: 0.2g | Carbs: 12g | Protein: 8.3g" },
  { food_name: "Avocado", food_description: "Per 1 medium - Calories: 240kcal | Fat: 22g | Carbs: 12g | Protein: 3g" },
  { food_name: "Greek Yogurt", food_description: "Per 1 container (150g) - Calories: 130kcal | Fat: 0g | Carbs: 6g | Protein: 15g" },
  { food_name: "Peanut Butter", food_description: "Per 2 tbsp - Calories: 188kcal | Fat: 16g | Carbs: 6g | Protein: 8g" },
  { food_name: "Oatmeal", food_description: "Per 1 cup cooked - Calories: 150kcal | Fat: 2.5g | Carbs: 27g | Protein: 5g" },
  { food_name: "French Fries", food_description: "Per 1 medium serving - Calories: 365kcal | Fat: 17g | Carbs: 48g | Protein: 4g" },
  { food_name: "Pepperoni Pizza Slice", food_description: "Per 1 slice - Calories: 290kcal | Fat: 12g | Carbs: 32g | Protein: 12g" },
  { food_name: "Beef Steak", food_description: "Per 150g - Calories: 380kcal | Fat: 22g | Carbs: 0g | Protein: 42g" },
  { food_name: "Grilled Salmon", food_description: "Per 150g - Calories: 310kcal | Fat: 18g | Carbs: 0g | Protein: 34g" },
  { food_name: "Tuna Salad", food_description: "Per 1 cup - Calories: 290kcal | Fat: 19g | Carbs: 4g | Protein: 26g" },
  { food_name: "Caesar Salad", food_description: "Per 1 bowl - Calories: 350kcal | Fat: 28g | Carbs: 12g | Protein: 8g" },
  { food_name: "Mixed Green Salad", food_description: "Per 1 bowl - Calories: 45kcal | Fat: 0g | Carbs: 8g | Protein: 2g" },
  { food_name: "Beef Burger", food_description: "Per 1 burger - Calories: 540kcal | Fat: 29g | Carbs: 40g | Protein: 30g" },
  { food_name: "Pasta Bolognese", food_description: "Per 1 plate - Calories: 420kcal | Fat: 14g | Carbs: 58g | Protein: 18g" },
  { food_name: "Sushi Roll (Salmon)", food_description: "Per 6 pieces - Calories: 240kcal | Fat: 5g | Carbs: 38g | Protein: 9g" },
  { food_name: "Black Coffee", food_description: "Per 1 cup - Calories: 2kcal | Fat: 0g | Carbs: 0g | Protein: 0.3g" },
  { food_name: "Latte Coffee", food_description: "Per 1 cup - Calories: 120kcal | Fat: 4g | Carbs: 12g | Protein: 7g" },
  { food_name: "Green Tea", food_description: "Per 1 cup - Calories: 2kcal | Fat: 0g | Carbs: 0g | Protein: 0g" },
  { food_name: "Chocolate Chip Cookie", food_description: "Per 1 cookie - Calories: 120kcal | Fat: 6g | Carbs: 16g | Protein: 1.5g" }
];

export interface FatSecretFood {
  food_id: string;
  food_name: string;
  food_description: string;
}

// Generate the OAuth 1.0a HMAC-SHA1 signature
export function generateOAuth1Signature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ""
): string {
  // Sort parameters alphabetically
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");

  // Format: [HTTPMethod]&[PercentEncodedURL]&[PercentEncodedParameters]
  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join("&");

  // Format: [PercentEncodedConsumerSecret]&[PercentEncodedTokenSecret]
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  // Hashing
  const hash = CryptoJS.HmacSHA1(baseString, signingKey);
  return CryptoJS.enc.Base64.stringify(hash);
}

// Helper to filter local mock database items
function fallbackSearch(query: string): FatSecretFood[] {
  const lowerQuery = query.toLowerCase();
  return MOCK_FOODS.filter((food) =>
    food.food_name.toLowerCase().includes(lowerQuery)
  )
    .map((food, idx) => ({
      food_id: `mock-${idx}`,
      food_name: food.food_name,
      food_description: food.food_description,
    }))
    .slice(0, 5);
}

export async function searchFatSecretFoods(query: string): Promise<FatSecretFood[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) return [];

  if (
    !CLIENT_ID ||
    !CLIENT_SECRET ||
    CLIENT_ID === "YOUR_CLIENT_ID" ||
    CLIENT_SECRET === "YOUR_CLIENT_SECRET"
  ) {
    console.warn("FatSecret credentials not configured. Falling back to local search.");
    return fallbackSearch(trimmedQuery);
  }

  try {
    const url = "https://platform.fatsecret.com/rest/server.api";

    const oauthParams: Record<string, string> = {
      method: "foods.search",
      search_expression: trimmedQuery,
      format: "json",
      max_results: "5",
      oauth_consumer_key: CLIENT_ID,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: Math.random().toString(36).substring(2) + Date.now().toString(36),
      oauth_version: "1.0",
    };

    // Calculate OAuth 1.0 HMAC-SHA1 signature (2-legged flow so tokenSecret is empty)
    const signature = generateOAuth1Signature("POST", url, oauthParams, CLIENT_SECRET);
    oauthParams["oauth_signature"] = signature;

    const bodyParams = new URLSearchParams(oauthParams);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      throw new Error(`FatSecret API error response status: ${response.status}`);
    }

    const data = await response.json();

    // Check for API errors in the payload
    if (data.error) {
      throw new Error(`FatSecret API error: ${data.error.message}`);
    }

    const foods = data.foods?.food;

    if (!foods) return [];

    if (Array.isArray(foods)) {
      return foods.slice(0, 5);
    } else if (typeof foods === "object") {
      return [foods];
    }
  } catch (error) {
    console.error("FatSecret API OAuth 1.0 query failed. Using mock fallback values.", error);
    return fallbackSearch(trimmedQuery);
  }

  return [];
}
