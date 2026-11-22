from agents import build_search_agent, build_reader_agent, writer_chain, critic_chain
import sys

# Windows consoles default to cp1252, which chokes on unicode in search results
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

def run_research_pipeline(topic:str, on_progress=None)-> dict:
    # on_progress(stage, message) lets a UI follow along; CLI runs without one
    progress = on_progress or (lambda *args: None)
    state ={}

    progress("search", "Searching the web")

    # search_agent

    print('\n ---------------------------------------')
    search_agent = build_search_agent()
    search_result = search_agent.invoke({
        "messages":[
            ("user", f"Search for information about {topic}")
        ]
    })

    state['search_result'] = search_result['messages'][-1].content

    print('\n Search Result: ', state['search_result'])

    # reader_agent
    print('\n ---------------------------------------')
    progress("read", "Reading the most relevant source")
    reader_agent = build_reader_agent()
    reader_result = reader_agent.invoke({
        'messages':[
            ('user',f'Based on the following search result about {topic}.'
           f"pick the most relevant URL and scrape it for deeper content.\n\n"
           f"Search Result: {state['search_result'][:800]}"
           )]})

    state['scraped_content'] = reader_result['messages'][-1].content

    print('\n Scraped Content: ', state['scraped_content'][:800]) 

    # writer_chain
    print('\n ---------------------------------------')
    progress("write", "Writing the research report")
    research_combined = (
        f"Search results: \n {state['search_result']}\n\n"
        f"Scraped content: \n {state['scraped_content']}"
    )        

    state['report'] = writer_chain.invoke({
        'topic': topic,
        'research': research_combined
    })

    print('\n Final Report: ', state['report'])


    #critic report
    print('\n ---------------------------------------')
    progress("critique", "Critiquing the report")
    state['feedback'] = critic_chain.invoke({
        'report': state['report']
    })

    return state


if __name__ == "__main__":
    topic = input("\nEnter a topic to research: ")
    run_research_pipeline(topic)