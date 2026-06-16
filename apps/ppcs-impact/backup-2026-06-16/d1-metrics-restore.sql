-- D1 backup of `wv-ppcs-impact` metrics table — captured 2026-06-16
-- DB: wv-ppcs-impact  uuid a5ea2fcf-299d-494d-9580-1184fe889d8c  account 097c92553b268f8360b74f625f6d980a
-- Restore:  npx wrangler d1 execute wv-ppcs-impact --remote --file=./d1-metrics-restore.sql
CREATE TABLE IF NOT EXISTS metrics (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')));
INSERT OR REPLACE INTO metrics (k, v, updated_at) VALUES ('current', '{
  "weekly": [
    {
      "week": 1,
      "registrants": 941,
      "attended": 511,
      "rate": 54
    },
    {
      "week": 2,
      "registrants": 947,
      "attended": 455,
      "rate": 48
    },
    {
      "week": 3,
      "registrants": 946,
      "attended": 422,
      "rate": 45
    },
    {
      "week": 4,
      "registrants": 947,
      "attended": 390,
      "rate": 41
    },
    {
      "week": 5,
      "registrants": 950,
      "attended": 377,
      "rate": 40
    }
  ],
  "sessions": [
    {
      "week": 1,
      "cohort": "9am",
      "attended": 392
    },
    {
      "week": 1,
      "cohort": "6pm",
      "attended": 119
    },
    {
      "week": 2,
      "cohort": "9am",
      "attended": 339
    },
    {
      "week": 2,
      "cohort": "6pm",
      "attended": 116
    },
    {
      "week": 3,
      "cohort": "9am",
      "attended": 313
    },
    {
      "week": 3,
      "cohort": "6pm",
      "attended": 109
    },
    {
      "week": 4,
      "cohort": "9am",
      "attended": 289
    },
    {
      "week": 4,
      "cohort": "6pm",
      "attended": 101
    },
    {
      "week": 5,
      "cohort": "9am",
      "attended": 273
    },
    {
      "week": 5,
      "cohort": "6pm",
      "attended": 104
    }
  ],
  "commons": [
    {
      "week": 1,
      "posts": 162,
      "comments": 718,
      "replies": 484
    },
    {
      "week": 2,
      "posts": 172,
      "comments": 567,
      "replies": 247
    },
    {
      "week": 3,
      "posts": 165,
      "comments": 523,
      "replies": 187
    },
    {
      "week": 4,
      "posts": 141,
      "comments": 496,
      "replies": 129
    },
    {
      "week": 5,
      "posts": 87,
      "comments": 292,
      "replies": 102
    }
  ],
  "depth": [
    {
      "week": 1,
      "per_author": 5.05,
      "responses_per_post": 7.42,
      "pct_posts_answered": 76,
      "pct_meeting_3plus": 85
    },
    {
      "week": 2,
      "per_author": 4.25,
      "responses_per_post": 4.73,
      "pct_posts_answered": 90,
      "pct_meeting_3plus": 78
    },
    {
      "week": 3,
      "per_author": 4.31,
      "responses_per_post": 4.3,
      "pct_posts_answered": 88,
      "pct_meeting_3plus": 82
    },
    {
      "week": 4,
      "per_author": 4.01,
      "responses_per_post": 4.43,
      "pct_posts_answered": 90,
      "pct_meeting_3plus": 82
    },
    {
      "week": 5,
      "per_author": 4.04,
      "responses_per_post": 4.53,
      "pct_posts_answered": 94,
      "pct_meeting_3plus": 77
    }
  ],
  "reach_benchmark": {
    "band": [
      40,
      60
    ],
    "decay_pct_per_session": 12,
    "expected": [
      54,
      48,
      42,
      37,
      33
    ]
  },
  "sentiment": [
    0.309,
    0.34,
    0.3,
    0.331,
    0.374
  ],
  "prime": [
    {
      "p": "Relationship-centred",
      "v": 18.4
    },
    {
      "p": "Experiential",
      "v": 13.8
    },
    {
      "p": "Personal",
      "v": 11.8
    },
    {
      "p": "Modular",
      "v": 7.3
    },
    {
      "p": "Insightful",
      "v": 5.3
    }
  ],
  "themes": [
    {
      "t": "Systems Thinking",
      "d": [
        28,
        7,
        5,
        5,
        15
      ]
    },
    {
      "t": "Hidden Curriculum",
      "d": [
        3,
        23,
        4,
        4,
        4
      ]
    },
    {
      "t": "Permission & Play",
      "d": [
        8,
        16,
        25,
        7,
        5
      ]
    },
    {
      "t": "Agency/Power/Tech",
      "d": [
        13,
        6,
        7,
        45,
        12
      ]
    },
    {
      "t": "Community & Movement",
      "d": [
        12,
        15,
        14,
        15,
        26
      ]
    }
  ],
  "kpis": {
    "unique_registrants": 915,
    "unique_attendees": 623,
    "show_rate": 44,
    "commons_contributions": 4472,
    "commons_authors": 289,
    "survey_n": 37,
    "attendance_retention": 74,
    "cert_applied_n": null
  },
  "poll": {
    "n": 148,
    "spine_matched": 130,
    "avg_prme_familiarity": 2.61,
    "avg_confidence": 3.64,
    "approach": {
      "lecture": 8,
      "mix": 55,
      "active": 18,
      "experimenting": 18
    },
    "motivation": {
      "improve_practice": 69,
      "explore_pedagogy": 62,
      "earn_cert": 13,
      "connect_peers": 4
    },
    "familiarity_dist": {
      "1": 28,
      "2": 36,
      "3": 56,
      "4": 21,
      "5": 7
    },
    "confidence_dist": {
      "1": 5,
      "2": 13,
      "3": 34,
      "4": 74,
      "5": 22
    }
  }
}', '2026-06-15 18:30:13');
