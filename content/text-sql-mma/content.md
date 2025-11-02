## The Problem with LLMs and Statistics

If you've ever tried to ask ChatGPT or Claude complex statistical questions, you've probably noticed something: they're surprisingly bad at it. Ask "Which fighter over the age of 35 has the most wins at fights that took place inside Canada?" and you'll get a confident answer that's completely wrong.

This isn't really a bug, it's just a limitation of current models. Progress on no-hallucination arithmetic has been very fast, but the more complexity and agentic lookups required for a task, the more likely the LLM is to get lost.

## Text-to-SQL: A Better Approach

I recently implemented part a paper that takes a different approach: instead of asking the LLM to know the answer, we ask it to *write a SQL query* to find the answer. The LLM becomes a translator between human questions and database queries.

Here's how it works:
1. User asks a question in natural language
2. LLM translates it into a SQL query
3. Query runs against the database
4. LLM takes the results and formats them into a readable response

This plays to each system's strengths: LLMs are great at understanding what you mean and generating readable text, while databases are great at actually crunching numbers and filtering data.

This is by no means a sim

## MMA Statistics: A Perfect Test Case

For our proof of concept, we chose MMA (Mixed Martial Arts) statistics. Combat sports data is ideal for testing this approach because of the complex relationships and statistical depth. Additionally, it is common to see complex data points on UFC pay-per-view events, making this a useful method for non-technical UFC employees to quickly generate creative insights for the broadcast.

We scraped an MMA statistics database and built a query system on top of it.

## Handling Complex Queries

The fun part is watching the system handle queries that could easily confuse a 2024 frontier model.
Imagine a query based on our example: "Which fighter over the age of 35 has the most wins at fights that took place inside Canada?"

This needs:
- Age calculation from birthdate
- Filtering by age
- Joining fight records with location data
- Filtering by country
- Counting wins
- Sorting and returning the top result

For a SQL database, this is straightforward. In contrast, an LLM such as Claude 3.5 Sonnet might struggle with this.

```sql
SELECT f.name, COUNT(*) as wins
FROM fighters f
JOIN fight_records fr ON f.id = fr.fighter_id
JOIN events e ON fr.event_id = e.id
WHERE (CURRENT_DATE - f.birthdate) / 365 > 35
  AND e.location LIKE '%Canada%'
  AND fr.result = 'Win'
GROUP BY f.id, f.name
ORDER BY wins DESC
LIMIT 1;
```

## The Translation Challenge

The tricky part is getting the LLM to consistently generate valid SQL that actually does what the user wants.

This means dealing with:
- Providing the database schema in the prompt
- Adding example queries so it learns the pattern
- Handling vague questions (does "wins" mean all wins or just knockouts?)
- Catching invalid SQL before it breaks things
- Balancing SQL injection prevention with natural language flexibility

Additionally, many users, especially those with less technical backgrounds, may not clearly state their intent and the LLM could strugle to fil in the gaps.

## Where This Could Actually Be Useful

While this was just a proof of concept, the pattern works for a lot of real-world stuff, anywhere you have structured data and people who need answers but don't want to write SQL.

**Sports Analytics**: Teams could query stats conversationally without needing to know SQL  
**Business Intelligence**: Sales teams could ask about revenue and customer data in plain English  
**Medical Research**: Researchers could query patient databases without writing queries  
**E-commerce**: "Show me products under $50 that shipped to California last month with 5-star reviews"


## Limitations and Trade-offs

- **Schema dependency**: The LLM needs to understand your database structure, which gets messy with complex schemas
- **Query optimization**: Auto-generated queries probably won't be as fast as hand-tuned ones
- **Ambiguity**: Natural language is fuzzy; "best fighter" could mean a dozen different things
- **Cost**: Every query needs an LLM call, which adds latency and API costs
- **Validation**: You need safeguards to make sure the generated SQL is safe and correct


## Try It Yourself

The code is up on GitHub at [https://github.com/jackinthebox52/mma-qa](https://github.com/jackinthebox52/mma-qa). It's built specifically for MMA stats, but the pattern works for pretty much any structured data.

This approach is much less resource intensive than training an LLM to memorize facts, and can be easily updated without spending tons of time and money retraining. It's alos way more reliable, and the resultingSQL can be run through a linter to verify that it will execute.
