/**
 * CLOUDFLARE WORKER: Notion API Proxy
 * 
 * This worker proxies requests to the Notion API, hiding your API key
 * and handling CORS for browser requests.
 * 
 * DEPLOYMENT:
 * 1. Go to https://workers.cloudflare.com
 * 2. Create a new Worker
 * 3. Paste this code
 * 4. Add environment variable: NOTION_API_KEY
 * 5. Deploy and copy the worker URL
 * 6. Update NOTION_PROXY_URL in do-client-side/index.html
 */

// Your Notion database IDs
const DATABASE_IDS = {
  quadrants: 'cd46b216-0aa1-4bc9-bd95-85af0abe5245',
  outcomes: 'e7ca178b-986a-4436-a869-554db20196f5',
  examples: 'fd9ce109-2b4b-4a85-b0a5-04d21e04a51e',
};

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const notionHeaders = {
        'Authorization': 'Bearer ' + env.NOTION_API_KEY,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      };

      // Fetch all databases in parallel
      const [quadrantsRes, outcomesRes, examplesRes] = await Promise.all([
        fetch('https://api.notion.com/v1/databases/' + DATABASE_IDS.quadrants + '/query', {
          method: 'POST', headers: notionHeaders, body: '{}'
        }),
        fetch('https://api.notion.com/v1/databases/' + DATABASE_IDS.outcomes + '/query', {
          method: 'POST', headers: notionHeaders,
          body: JSON.stringify({ sorts: [{ property: 'Order', direction: 'ascending' }] })
        }),
        fetch('https://api.notion.com/v1/databases/' + DATABASE_IDS.examples + '/query', {
          method: 'POST', headers: notionHeaders,
          body: JSON.stringify({ sorts: [{ property: 'Order', direction: 'ascending' }] })
        }),
      ]);

      const [quadrantsData, outcomesData, examplesData] = await Promise.all([
        quadrantsRes.json(), outcomesRes.json(), examplesRes.json()
      ]);

      // Process quadrants
      const packs = {};
      for (const page of quadrantsData.results) {
        const props = page.properties;
        const key = props['Quadrant Key']?.select?.name;
        if (key) {
          packs[key] = {
            title: getText(props['Title']),
            promise: getText(props['Promise']),
            quadrantStory: getText(props['Quadrant Story']),
            story: getText(props['How We Work']),
            crossover: getText(props['Crossover Note']),
            outcomes: [],
            examples: [],
          };
        }
      }

      // Process outcomes
      for (const page of outcomesData.results) {
        const props = page.properties;
        const quadrant = props['Quadrant']?.select?.name;
        if (quadrant && packs[quadrant]) {
          packs[quadrant].outcomes.push({
            title: getTitle(props['Name']),
            detail: getText(props['Detail']),
          });
        }
      }

      // Process examples
      for (const page of examplesData.results) {
        const props = page.properties;
        const quadrant = props['Quadrant']?.select?.name;
        if (quadrant && packs[quadrant]) {
          packs[quadrant].examples.push({
            title: getTitle(props['Name']),
            type: getText(props['Type']),
            icon: getText(props['Icon']),
            url: props['URL']?.url || props['userDefined:URL']?.url || '',
            detail: getText(props['Detail']),
          });
        }
      }

      const content = {
        lastUpdated: new Date().toISOString(),
        packs,
      };

      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
};

// Helper functions
function getText(prop) {
  if (!prop) return '';
  if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
  return '';
}

function getTitle(prop) {
  if (!prop) return '';
  if (prop.title) return prop.title.map(t => t.plain_text).join('');
  return '';
}
