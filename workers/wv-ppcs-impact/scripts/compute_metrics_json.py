#!/usr/bin/env python3
"""Reproduce dashboard_metrics() (migration 0004) from the SQLite engagement DB.
Emits metrics.json — the exact /api/metrics contract — for serving from D1.
Source of truth remains the live dashboard; this mirrors it from the same data."""
import sqlite3, json, os

DB = os.environ.get("PPCS_DB",
  "/Users/garrettjaeger/Library/CloudStorage/GoogleDrive-garrett@windedvertigo.com/Shared drives/winded.vertigo/clients/UN PRME/2026 PRME and beyond/2 PPCS content/Engagement Evidence/Database/PPCS2026_engagement.db")
con = sqlite3.connect(DB); cur = con.cursor()
def q(s, a=()): return cur.execute(s, a).fetchall()

# weekly registrants / attended / rate
weekly=[]
for wk in range(1,6):
    reg=q("select coalesce(sum(n_registrants),0) from session_event where week_no=?",(wk,))[0][0]
    att=q("""select count(*) from attendance a join session_event se on se.session_event_id=a.session_event_id
             where se.week_no=? and a.attended=1""",(wk,))[0][0]
    weekly.append({"week":wk,"registrants":reg,"attended":att,"rate":round(100*att/reg) if reg else 0})

sessions=[]
for wk in range(1,6):
    for co in ("09am","06pm"):
        att=q("""select count(*) from attendance a join session_event se on se.session_event_id=a.session_event_id
                 where se.week_no=? and se.cohort=? and a.attended=1""",(wk,co))[0][0]
        sessions.append({"week":wk,"cohort":"9am" if co=="09am" else "6pm","attended":att})

commons=[]; depth=[]
for wk in range(1,6):
    posts=q("select count(*) from commons_contribution where week_no=? and contribution_type='post'",(wk,))[0][0]
    comments=q("select count(*) from commons_contribution where week_no=? and contribution_type='comment'",(wk,))[0][0]
    replies=q("select count(*) from commons_contribution where week_no=? and contribution_type='reply'",(wk,))[0][0]
    commons.append({"week":wk,"posts":posts,"comments":comments,"replies":replies})
    total=q("select count(*) from commons_contribution where week_no=?",(wk,))[0][0]
    authors=q("select count(distinct participant_id) from commons_contribution where week_no=?",(wk,))[0][0]
    per_author=round(total/authors,2) if authors else 0
    rpp=round((comments+replies)/posts,2) if posts else 0
    answered=q("""select round(100.0*sum(case when exists(
                   select 1 from commons_contribution r where r.thread_id=p.thread_id
                     and r.contribution_type in ('comment','reply')) then 1 else 0 end)/count(*))
                 from commons_contribution p where p.contribution_type='post' and p.week_no=?""",(wk,))[0][0]
    meeting=q("""select round(100.0*sum(case when n>=3 then 1 else 0 end)/count(*)) from
                 (select participant_id, count(*) n from commons_contribution where week_no=? group by participant_id) x""",(wk,))[0][0]
    depth.append({"week":wk,"per_author":per_author,"responses_per_post":rpp,
                  "pct_posts_answered":int(answered or 0),"pct_meeting_3plus":int(meeting or 0)})

# reach_benchmark expected curve
w1=weekly[0]; w1_rate=100*w1["attended"]/w1["registrants"]
expected=[round(w1_rate*(0.88**(wk-1))) for wk in range(1,6)]
reach_benchmark={"band":[40,60],"decay_pct_per_session":12,"expected":expected}

# sentiment per week (chat + commons), mean compound
sentiment=[]
for wk in range(1,6):
    r=q("""select round(avg(sentiment_score),3) from sentiment_annotation sa where
       (sa.source_type='chat' and sa.source_id in (select cast(message_id as text) from chat_message cm
            join session_event se on se.session_event_id=cm.session_event_id where se.week_no=?))
       or (sa.source_type='commons' and sa.source_id in (select contribution_id from commons_contribution where week_no=?))""",(wk,wk))[0][0]
    sentiment.append(r)

# PRIME prevalence
corpus=q("select count(*) from v_text_unit where text is not null and trim(text)<>''")[0][0]
prime=[]
for cid,nm in q("select code_id,code_name from code where arc_theme='PRIME design principle' order by code_id"):
    n=q("select count(distinct source_type||source_id) from coding where code_id=? and coder='ai-firstpass-prime'",(cid,))[0][0]
    prime.append({"p":nm.replace("PRIME: ",""),"v":round(100*n/corpus,1)})
prime.sort(key=lambda x:-x["v"])

# themes diagonal (arc codes 1-5)
labels={1:"Systems Thinking",2:"Hidden Curriculum",3:"Permission & Play",4:"Agency/Power/Tech",5:"Community & Movement"}
themes=[]
for cid in [1,2,3,4,5]:
    d=[]
    for wk in range(1,6):
        den=q("""select count(*) from v_text_unit u where u.text is not null and trim(u.text)<>'' and (
              (u.source_type='commons' and u.source_id in (select contribution_id from commons_contribution where week_no=?))
              or (u.source_type='chat' and u.source_id in (select cast(message_id as text) from chat_message cm join session_event se on se.session_event_id=cm.session_event_id where se.week_no=?)))""",(wk,wk))[0][0]
        num=q("""select count(distinct cg.source_type||cg.source_id) from coding cg where cg.code_id=? and cg.coder='ai-firstpass-keyword' and (
              (cg.source_type='commons' and cg.source_id in (select contribution_id from commons_contribution where week_no=?))
              or (cg.source_type='chat' and cg.source_id in (select cast(message_id as text) from chat_message cm join session_event se on se.session_event_id=cm.session_event_id where se.week_no=?)))""",(cid,wk,wk))[0][0]
        d.append(round(100*num/den) if den else 0)
    themes.append({"t":labels[cid],"d":d})

kpis={
 "unique_registrants": q("select count(distinct a.participant_id) from attendance a join participant p on p.participant_id=a.participant_id where p.is_facilitator=0")[0][0],
 "unique_attendees":   q("select count(distinct a.participant_id) from attendance a join participant p on p.participant_id=a.participant_id where a.attended=1 and p.is_facilitator=0")[0][0],
 "show_rate": 44,
 "commons_contributions": q("select count(*) from commons_contribution")[0][0],
 "commons_authors": q("select count(distinct participant_id) from commons_contribution")[0][0],
 "survey_n": q("select count(*) from survey_response where survey_id != 2")[0][0],
 "attendance_retention": round(100*weekly[4]["attended"]/weekly[0]["attended"]),
 "cert_participation_n": 710,  # confirmed by PRME Secretariat 2026-06-16: PRME-signatory individuals meeting Cert of Participation requirements
 "cert_applied_n": None,  # Certificate of Applied Practice — not available until after the capstone deadline (Dec 2026); no Certificate of Excellence in 2026
}
# show_rate = mean of 9am/6pm overall rates
reg9=q("select coalesce(sum(n_registrants),0) from session_event where cohort='09am'")[0][0]
reg6=q("select coalesce(sum(n_registrants),0) from session_event where cohort='06pm'")[0][0]
att9=q("select count(*) from attendance a join session_event se on se.session_event_id=a.session_event_id where se.cohort='09am' and a.attended=1")[0][0]
att6=q("select count(*) from attendance a join session_event se on se.session_event_id=a.session_event_id where se.cohort='06pm' and a.attended=1")[0][0]
kpis["show_rate"]=round(((att9/reg9 + att6/reg6)/2)*100) if reg9 and reg6 else 44

# MindShift intro poll baseline (survey_id=2)
def approach_pct(label):
    n=q("select count(*) from survey_answer where item_code='poll_teaching_approach' and answer_text=?",(label,))[0][0]
    tot=q("select count(*) from survey_answer where item_code='poll_teaching_approach'")[0][0]
    return round(100*n/tot) if tot else 0

poll_n   = q("select count(*) from survey_response where survey_id=2")[0][0]
poll_matched = q("select count(*) from survey_response where survey_id=2 and participant_id is not null")[0][0]
avg_fam  = q("select round(avg(answer_numeric),2) from survey_answer where item_code='poll_prme_familiarity'")[0][0]
avg_conf = q("select round(avg(answer_numeric),2) from survey_answer where item_code='poll_confidence'")[0][0]
poll={
  "n": poll_n,
  "spine_matched": poll_matched,
  "avg_prme_familiarity": float(avg_fam) if avg_fam else None,
  "avg_confidence": float(avg_conf) if avg_conf else None,
  "approach": {
    "lecture":       approach_pct("primarily lecture-based"),
    "mix":           approach_pct("mix of lecture and activities"),
    "active":        approach_pct("primarily active/experiential"),
    "experimenting": approach_pct("experimenting with new methods"),
  },
  "motivation": {
    "improve_practice": q("select count(*) from survey_answer where item_code='poll_motivation' and answer_text='improve my teaching practice'")[0][0],
    "explore_pedagogy": q("select count(*) from survey_answer where item_code='poll_motivation' and answer_text='explore new pedagogical approaches'")[0][0],
    "earn_cert":        q("select count(*) from survey_answer where item_code='poll_motivation' and answer_text='earn a certificate'")[0][0],
    "connect_peers":    q("select count(*) from survey_answer where item_code='poll_motivation' and answer_text='connect with peers globally'")[0][0],
  },
  "familiarity_dist": {
    str(i): q("select count(*) from survey_answer where item_code='poll_prme_familiarity' and answer_numeric=?",(i,))[0][0]
    for i in range(1,6)
  },
  "confidence_dist": {
    str(i): q("select count(*) from survey_answer where item_code='poll_confidence' and answer_numeric=?",(i,))[0][0]
    for i in range(1,6)
  },
}

out={"weekly":weekly,"sessions":sessions,"commons":commons,"depth":depth,
     "reach_benchmark":reach_benchmark,"sentiment":sentiment,"prime":prime,"themes":themes,
     "kpis":kpis,"poll":poll}
here=os.path.dirname(os.path.abspath(__file__))
open(os.path.join(here,"..","metrics.json"),"w").write(json.dumps(out,indent=2))
print(json.dumps(out,indent=1))
