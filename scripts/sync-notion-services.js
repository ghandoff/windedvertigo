const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = '28fe4ee74ba480869709d4d364d388e5';

async function getServices() {
  const response = await notion.databases.query({
    database_id: databaseId,
  });

  const services = [];

  for (const page of response.results) {
    const props = page.properties;

    // Get title
    const titleProp = props.title?.title || [];
    const title = titleProp.map(t => t.plain_text).join('').replace(/^\*/, '');

    // Get description
    const descProp = props.description?.rich_text || [];
    const description = descProp.map(t => t.plain_text).join('');

    if (title && description) {
      services.push({ title, description });
    }
  }

  return services;
}

function generateServicesHTML(services) {
  return services.map(service => `
        <article class="service">
          <h3>${escapeHTML(service.title)}</h3>
          <p>${escapeHTML(service.description)}</p>
        </article>`).join('\n');
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function updateDoPage(servicesHTML) {
  // Monorepo: static site pages live under apps/site/
  const doPagePath = path.join(__dirname, '..', 'apps', 'site', 'do', 'index.html');
  let html = fs.readFileSync(doPagePath, 'utf8');

  // Find and replace the services grid content
  const startMarker = '<div class="services-grid">';
  const endMarker = '<section class="projects-section">';

  const startIndex = html.indexOf(startMarker);
  const endIndex = html.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find services grid markers in do/index.html');
    process.exit(1);
  }

  const newHTML = html.substring(0, startIndex + startMarker.length) +
    '\n' + servicesHTML + '\n      </div>\n\n      ' +
    html.substring(endIndex);

  fs.writeFileSync(doPagePath, newHTML);
  console.log('Updated do/index.html with', servicesHTML.split('<article').length - 1, 'services');
}

async function main() {
  try {
    console.log('Fetching services from Notion...');
    const services = await getServices();
    console.log(`Found ${services.length} services`);

    const servicesHTML = generateServicesHTML(services);
    await updateDoPage(servicesHTML);

    console.log('Sync complete!');
  } catch (error) {
    console.error('Error syncing services:', error);
    process.exit(1);
  }
}

main();
