import { Client } from '@notionhq/client';

const database_id = process.env.NOTION_INBOX_DATABASE_ID;

function get_client(token) {
  return new Client({ auth: token || process.env.NOTION_API_KEY });
}

export async function create_capture({ type, content, priority, assignee_notion_id, token }) {
  try {
    const notion = get_client(token);

    const properties = {
      'capture': {
        title: [{ text: { content } }]
      },
      'type': {
        select: { name: type }
      },
      'priority': {
        select: { name: priority }
      },
      'processed': {
        checkbox: false
      }
    };

    // add assignee as a person property if provided
    // note: the inbox schema doesn't have an assignee property yet.
    // tasks with assignees are captured in the title text for now.
    // if an assignee column is added later, uncomment below:
    // if (assignee_notion_id) {
    //   properties['assignee'] = {
    //     people: [{ id: assignee_notion_id }]
    //   };
    // }

    console.log(`[notion] creating ${type} capture: "${content.substring(0, 50)}..."`);

    const page = await notion.pages.create({
      parent: { database_id },
      properties
    });

    console.log(`[notion] created page: ${page.id}`);

    return {
      success: true,
      page_id: page.id,
      url: page.url
    };
  } catch (err) {
    console.error(`[notion] create failed: ${err.message}`);
    return {
      success: false,
      error: err.message
    };
  }
}
