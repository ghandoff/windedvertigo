# pocket.prompts — iOS Shortcut setup

> build this shortcut in apple shortcuts on your iphone. it creates a
> conversational loop: dictate → send to pocket → hear response → dictate again.
> works with airpods, in your pocket, no screen required.

## shortcut name

`pocket.prompts`

## trigger options

- **siri**: "hey siri, pocket prompts"
- **back tap**: settings → accessibility → touch → back tap → double/triple tap → pocket.prompts
- **home screen**: add shortcut to home screen as a one-tap icon
- **action button** (iphone 15 pro+): settings → action button → shortcut → pocket.prompts

## shortcut actions (build in this order)

### 1. set user id

- **action:** `Set Variable`
- **variable name:** `user_id`
- **value:** `garrett` (change per person)

### 2. start conversation loop

- **action:** `Repeat`
- **repeat count:** `20` (max iterations — user can exit anytime)

### 3. dictate text (inside loop)

- **action:** `Dictate Text`
- **stop listening:** `After Short Pause`
- **language:** `English`
- **save result to variable:** `spoken_text`

### 4. check for exit phrase (inside loop)

- **action:** `If`
- **input:** `spoken_text`
- **condition:** `contains` → `stop` or `never mind` or `that's all`
- **then:** `Exit Shortcut`
- **end if**

### 5. send to pocket api (inside loop)

- **action:** `Get Contents of URL`
- **url:** `https://pocket-prompts-five.vercel.app/api/voice`
- **method:** `POST`
- **headers:**
  - `Content-Type` → `application/json`
- **request body:** `JSON`
  ```json
  {
    "text": "[spoken_text variable]",
    "user_id": "[user_id variable]"
  }
  ```
- **save result to variable:** `api_response`

### 6. extract spoken response (inside loop)

- **action:** `Get Dictionary Value`
- **dictionary:** `api_response`
- **key:** `spoken_response`
- **save result to variable:** `response_text`

### 7. speak the response (inside loop)

- **action:** `Speak Text`
- **text:** `response_text`
- **language:** `English (United States)`
- **rate:** `default` (adjust if too fast/slow)
- **wait until finished:** `yes`

### 8. end repeat

the loop goes back to step 3 — dictate again.

## the conversational flow

```
you: [tap or "hey siri, pocket prompts"]
shortcut: [starts listening]

you: "check my slack"
shortcut: [sends to api, gets summary]
phone: "you've got 3 new messages. lamis asked about the rubric
        timeline. maria shared the assessment draft. and jamie
        wants a playdate thursday. want me to reply to any of
        them, or note something?"

you: "reply to lamis: friday works, let's sync then"
phone: "replied to lamis. anything else to say to them, or
        should i move on?"

you: "note: review maria's draft before the playdate"
phone: "noted — added to your inbox as a medium-priority note.
        anything else, or should i check your slack?"

you: "that's all"
shortcut: [exits]
```

## tips

- **airpods**: works best with airpods — speak text plays directly in ears
- **back tap**: double or triple tap the back of your phone to trigger
- **exit**: say "stop", "never mind", or "that's all" to end the loop
- **errors**: if the api is down, the shortcut will show a connection error. just try again.
- **offline**: won't work offline — needs internet for the api and claude

## sharing

once built, share via:
1. open the shortcut
2. tap the `...` menu → share → copy icloud link
3. send the link to collective members

each person just needs to change the `user_id` variable to their name.
