export function getDetailPrompt(url: string): string {
  return `
Please fetch and analyze the content of the TripAdvisor attraction page from the following URL and extract detailed information.

**Goal:** Create a single JSON object with the details of the attraction.

**Web Page URL:** \`${url}\`

**Required JSON Format:**
\`\`\`json
{
  "location_name": "string",
  "description": "string",
  "address": {
    "street": "string | null",
    "city": "string | null",
    "country": "string | null"
  },
  "openingHours": "string | null",
  "suggestedDuration": "string | null",
  "rating": "number",
  "topReviews": [
    {
      "title": "string",
      "text": "string",
      "author": "string",
      "rating": "number"
    }
  ]
}
\`\`\`

**Instructions:**
*   \`location_name\`: The main name of the attraction.
*   \`description\`: A detailed, comprehensive description from the "About" section.
*   \`address\`: Break down the location's address into components.
*   \`openingHours\`: Find the opening hours information.
*   \`suggestedDuration\`: Extract the suggested visit duration.
*   \`rating\`: The overall bubble rating (e.g., 4.5 out of 5).
*   \`topReviews\`: Extract the top 2-3 most relevant reviews, including their title, text, author, and rating.
`
}
