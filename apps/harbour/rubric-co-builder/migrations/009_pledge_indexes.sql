create index if not exists pledge_responses_room_idx
  on rubric_cobuilder.pledge_responses (room_id);

create index if not exists pledge_response_votes_response_idx
  on rubric_cobuilder.pledge_response_votes (pledge_response_id);
