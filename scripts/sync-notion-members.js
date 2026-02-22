const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const https = require('https');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Members database ID (from URL: https://www.notion.so/9d0e6ae1d7574503b611a5c289e44f5b)
const MEMBERS_DATABASE_ID = '9d0e6ae1d7574503b611a5c289e44f5b';

// Define the order of members (by name)
const MEMBER_ORDER = [
  'garrett jaeger',
  'maria altamirano',
  'jamie galpin',
  'lamis sabra',
  'aaron fruit',
  'payton jaeger'
];

async function downloadImage(url, filepath) {
  // Use fetch for better handling of Notion's signed S3 URLs
  const fetch = (await import('node-fetch')).default;

  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const buffer = await response.buffer();
    fs.writeFileSync(filepath, buffer);
    return true;
  } catch (err) {
    console.error(`Download error: ${err.message}`);
    throw err;
  }
}

async function fetchMembers() {
  const response = await notion.databases.query({
    database_id: MEMBERS_DATABASE_ID,
    filter: {
      property: 'active',
      checkbox: {
        equals: true
      }
    }
  });

  const members = [];

  for (const page of response.results) {
    const props = page.properties;

    // Get name
    const name = props['first & last name']?.title?.[0]?.plain_text || '';

    // Get role
    const role = props['company role']?.rich_text?.[0]?.plain_text || '';

    // Get bio
    const bio = props['bio']?.rich_text?.map(t => t.plain_text).join('') || '';

    // Get pronouns
    const pronouns = props['pronouns']?.select?.name || '';

    // Get skill sets (tags)
    const skillSets = props['skill sets']?.multi_select?.map(s => s.name) || [];

    // Get headshot URL if available
    let headshotUrl = null;
    let headshotFilename = null;
    if (props['headshot']?.files?.length > 0) {
      const file = props['headshot'].files[0];
      headshotUrl = file.file?.url || file.external?.url || null;
      if (headshotUrl) {
        // Create a safe filename from the member's name
        const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        headshotFilename = `${safeName}.jpg`;
      }
    }

    members.push({
      name,
      role,
      bio,
      pronouns,
      skillSets,
      headshotUrl,
      headshotFilename
    });
  }

  // Sort members by predefined order
  members.sort((a, b) => {
    const aIndex = MEMBER_ORDER.findIndex(n => a.name.toLowerCase().includes(n));
    const bIndex = MEMBER_ORDER.findIndex(n => b.name.toLowerCase().includes(n));
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return members;
}

function generateMemberHTML(member) {
  const pronounsText = member.pronouns ? ` [${member.pronouns}]` : '';
  const nameWithPronouns = member.name.toLowerCase();

  // Generate headshot HTML if available
  const headshotHTML = member.headshotFilename
    ? `<div class="member-photo">
            <img src="../images/members/${member.headshotFilename}" alt="${member.name}" class="member-headshot">
          </div>`
    : '';

  // Generate tags HTML
  const tagsHTML = member.skillSets.length > 0
    ? `<div class="tags">
            ${member.skillSets.map(tag => `<span class="tag">${tag}</span>`).join('\n            ')}
          </div>`
    : '';

  // Split bio into paragraphs
  const bioParagraphs = member.bio
    .split(/\n\n|\r\n\r\n/)
    .filter(p => p.trim())
    .map(p => `<p>${p.trim()}</p>`)
    .join('\n            ');

  return `
        <!-- ${member.name} -->
        <article class="team-member">
          ${headshotHTML}
                    <div class="member-content">
          <h2>${nameWithPronouns}${pronounsText ? '' : ''}</h2>
          <p class="role">${member.role.toLowerCase()}</p>
          <div class="bio">
            ${bioParagraphs || '<p></p>'}
          </div>
          ${tagsHTML}
                    </div>
        </article>`;
}

async function updateWePage(members) {
  // Monorepo: static site pages live under apps/site/
  const wePath = path.join(__dirname, '..', 'apps', 'site', 'we', 'index.html');
  let html = fs.readFileSync(wePath, 'utf8');

  // Generate members HTML
  const membersHTML = members.map(m => generateMemberHTML(m)).join('\n');

  // Replace the team-grid content
  const teamGridRegex = /(<div class="team-grid">)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/main>)/;
  const match = html.match(teamGridRegex);

  if (match) {
    html = html.replace(teamGridRegex, `$1\n${membersHTML}\n\n      $3`);
    fs.writeFileSync(wePath, html);
    console.log(`Updated we page with ${members.length} members`);
  } else {
    console.error('Could not find team-grid section in we/index.html');
  }
}

async function downloadHeadshots(members) {
  const imagesDir = path.join(__dirname, '..', 'apps', 'site', 'images', 'members');

  // Create members directory if it doesn't exist
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  for (const member of members) {
    if (member.headshotUrl && member.headshotFilename) {
      const filepath = path.join(imagesDir, member.headshotFilename);
      try {
        console.log(`Downloading headshot for ${member.name}...`);
        await downloadImage(member.headshotUrl, filepath);
        console.log(`  Saved to ${member.headshotFilename}`);
      } catch (err) {
        console.error(`  Failed to download: ${err.message}`);
      }
    }
  }
}

async function main() {
  console.log('Fetching members from Notion...');
  const members = await fetchMembers();
  console.log(`Found ${members.length} active members`);

  // Download headshots
  await downloadHeadshots(members);

  // Update the we page
  await updateWePage(members);
}

main().catch(console.error);
