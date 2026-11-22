from langchain.agents import create_agent
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from tools import web_search, scrape_url
from dotenv import load_dotenv
load_dotenv()

llm = ChatGroq(
    model = "openai/gpt-oss-120b",
    temperature = 0 
)


# 1st agent
def build_search_agent():

    return create_agent(
        model=llm,
        tools=[web_search]
    )


# 2nd agent
def build_reader_agent():
    return create_agent(
        model=llm,
        tools=[scrape_url]
    )

# writer chain
writer_prompt = ChatPromptTemplate.from_messages([
    ("system",'You are a expert researcher and writer. You will be given a topic and you will write a detailed report on it.'),
    ('human','''Write a detailed report on the topic: {topic}.
    
    Research Gathered:
    {research}

    structure your report with an introduction, main body, and conclusion.
    Use clear and concise language, and provide references to the sources of information used in your research.
    '''
    ),
])

# writer chain
writer_chain = writer_prompt | llm | StrOutputParser()

# critic chain
critic_prompt = ChatPromptTemplate.from_messages([
    ("system",'You are a sharp and constructive critic. You will be given a report and you will provide feedback on it.'),
    ('human','''Critique the following report: {report}.
    
    Respond in this exact format:
    Score : X/10
    Strengths : [list of strengths]
    Areas of Improvement: [list]

    One line verdict: [one line summary of your critique]

    
    ''')
])


critic_chain = critic_prompt | llm | StrOutputParser()

