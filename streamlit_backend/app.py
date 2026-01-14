"""
Streamlit RAG Admin Tool
Curate Q&A pairs for the LLM-free RAG system
"""

import streamlit as st
from supabase_client import (
    get_supabase_client, 
    get_or_create_knowledge_base,
    save_curated_qa,
    get_agents,
    find_best_answer,
    update_kb_status
)
from crawler import crawl_website, extract_qa_suggestions
from fishaudio_client import generate_speech_sync, AVAILABLE_VOICES
import base64

# Page config
st.set_page_config(
    page_title="RAG Admin - Q&A Curation",
    page_icon="🎙️",
    layout="wide"
)

# Custom CSS
st.markdown("""
<style>
    .stApp {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    }
    .main-header {
        text-align: center;
        padding: 2rem 0;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2.5rem;
        font-weight: bold;
    }
    .qa-card {
        background: rgba(255,255,255,0.05);
        border-radius: 10px;
        padding: 1.5rem;
        margin: 1rem 0;
        border: 1px solid rgba(255,255,255,0.1);
    }
    .success-badge {
        background: #10b981;
        color: white;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.8rem;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'crawled_pages' not in st.session_state:
    st.session_state.crawled_pages = []
if 'qa_suggestions' not in st.session_state:
    st.session_state.qa_suggestions = []
if 'selected_agent' not in st.session_state:
    st.session_state.selected_agent = None

# Header
st.markdown('<h1 class="main-header">🎙️ RAG Admin - Q&A Curation</h1>', unsafe_allow_html=True)
st.markdown("---")

# Sidebar - Agent Selection
with st.sidebar:
    st.header("📋 Configuration")
    
    try:
        client = get_supabase_client()
        agents = get_agents(client)
        
        if agents:
            agent_options = {f"{a['name']} ({a['id'][:8]}...)": a['id'] for a in agents}
            selected = st.selectbox("Select Agent", list(agent_options.keys()))
            st.session_state.selected_agent = agent_options[selected]
            
            # Show agent info
            agent = next((a for a in agents if a['id'] == st.session_state.selected_agent), None)
            if agent:
                st.info(f"**Website:** {agent.get('website_url', 'Not set')}")
        else:
            st.warning("No agents found. Create an agent first.")
            st.session_state.selected_agent = None
            
    except Exception as e:
        st.error(f"Failed to connect to Supabase: {e}")
        st.session_state.selected_agent = None
    
    st.markdown("---")
    st.header("🔊 Voice Preview")
    voice_options = {v['name']: v['id'] for v in AVAILABLE_VOICES}
    selected_voice = st.selectbox("Voice", list(voice_options.keys()))
    preview_voice_id = voice_options[selected_voice]

# Main content - Tabs
tab1, tab2, tab3, tab4 = st.tabs(["🌐 Crawl Website", "✏️ Create Q&A", "📚 Manage Q&A", "🔍 Test Queries"])

# Tab 1: Website Crawling
with tab1:
    st.header("Crawl Website for Content")
    
    col1, col2 = st.columns([3, 1])
    with col1:
        url_input = st.text_input("Website URL", placeholder="https://example.com")
    with col2:
        max_pages = st.number_input("Max Pages", min_value=1, max_value=20, value=5)
    
    if st.button("🕷️ Start Crawling", type="primary"):
        if url_input:
            with st.spinner(f"Crawling {url_input}..."):
                pages = crawl_website(url_input, max_pages=max_pages)
                st.session_state.crawled_pages = pages
                
                # Extract Q&A suggestions
                suggestions = []
                for page in pages:
                    suggestions.extend(extract_qa_suggestions(page))
                st.session_state.qa_suggestions = suggestions
                
            st.success(f"✅ Crawled {len(pages)} pages!")
        else:
            st.warning("Please enter a URL")
    
    # Show crawled content
    if st.session_state.crawled_pages:
        st.subheader("Crawled Pages")
        for i, page in enumerate(st.session_state.crawled_pages):
            with st.expander(f"📄 {page['title']} ({page['url'][:50]}...)"):
                st.write("**Headings:**")
                for h in page['headings'][:10]:
                    st.write(f"  • {h}")
                
                st.write("**Contacts:**")
                st.json(page.get('contacts', {}))
                
                st.write("**Content Preview:**")
                st.text(page['content'][:500] + "...")
        
        # Show Q&A suggestions
        if st.session_state.qa_suggestions:
            st.subheader("💡 Suggested Q&A Pairs")
            st.info("Review and customize these suggestions, then save them as curated Q&A pairs.")
            
            for i, suggestion in enumerate(st.session_state.qa_suggestions):
                with st.expander(f"Q: {suggestion['question']}"):
                    st.write("**Source Content:**")
                    st.text(suggestion['source_content'])
                    st.write("**Keywords:**", ", ".join(suggestion['keywords']))
                    
                    if st.button(f"📝 Customize & Save", key=f"customize_{i}"):
                        st.session_state[f'editing_{i}'] = suggestion

# Tab 2: Create Q&A
with tab2:
    st.header("Create Curated Q&A Pair")
    
    if not st.session_state.selected_agent:
        st.warning("Please select an agent from the sidebar first.")
    else:
        with st.form("create_qa_form"):
            question = st.text_input(
                "Question",
                placeholder="e.g., What are your business hours?",
                help="The question users might ask"
            )
            
            spoken_response = st.text_area(
                "Spoken Response",
                placeholder="e.g., We're open Monday through Friday from 8 AM to 6 PM, and Saturdays from 9 AM to 2 PM.",
                help="Write this exactly as it should be spoken - natural and conversational",
                height=150
            )
            
            keywords = st.text_input(
                "Keywords (comma-separated)",
                placeholder="hours, open, schedule, time",
                help="Keywords that help match this Q&A"
            )
            
            priority = st.slider("Priority", 0, 10, 5, help="Higher priority Q&As are preferred when multiple match")
            
            col1, col2 = st.columns(2)
            with col1:
                preview_btn = st.form_submit_button("🔊 Preview Voice")
            with col2:
                save_btn = st.form_submit_button("💾 Save Q&A", type="primary")
        
        # Preview voice (outside form to play audio)
        if preview_btn and spoken_response:
            with st.spinner("Generating voice preview..."):
                try:
                    audio_bytes = generate_speech_sync(spoken_response, preview_voice_id)
                    audio_base64 = base64.b64encode(audio_bytes).decode()
                    st.audio(audio_bytes, format="audio/mp3")
                    st.success("Voice preview generated!")
                except Exception as e:
                    st.error(f"Voice preview failed: {e}")
        
        # Save Q&A
        if save_btn:
            if question and spoken_response:
                try:
                    client = get_supabase_client()
                    kb_id = get_or_create_knowledge_base(
                        client, 
                        st.session_state.selected_agent,
                        url_input if 'url_input' in dir() else None
                    )
                    
                    keywords_list = [k.strip() for k in keywords.split(',') if k.strip()]
                    
                    save_curated_qa(
                        client,
                        kb_id,
                        question=question,
                        spoken_response=spoken_response,
                        keywords=keywords_list,
                        priority=priority
                    )
                    
                    update_kb_status(client, kb_id, 'ready')
                    st.success("✅ Q&A pair saved successfully!")
                    
                except Exception as e:
                    st.error(f"Failed to save: {e}")
            else:
                st.warning("Please fill in both Question and Spoken Response")

# Tab 3: Manage Q&A
with tab3:
    st.header("Manage Existing Q&A Pairs")
    
    if not st.session_state.selected_agent:
        st.warning("Please select an agent from the sidebar first.")
    else:
        if st.button("🔄 Refresh Q&A List"):
            st.rerun()
        
        try:
            client = get_supabase_client()
            
            # Get knowledge base for this agent
            kb_result = client.table('knowledge_bases').select('id').eq('agent_id', st.session_state.selected_agent).execute()
            
            if kb_result.data:
                kb_id = kb_result.data[0]['id']
                
                # Get all Q&A pairs
                qa_result = client.table('document_chunks').select('*').eq('kb_id', kb_id).order('priority', desc=True).execute()
                
                if qa_result.data:
                    st.info(f"Found {len(qa_result.data)} Q&A pairs")
                    
                    for qa in qa_result.data:
                        with st.expander(f"Q: {qa.get('question', 'No question')} (Priority: {qa.get('priority', 0)})"):
                            st.write("**Spoken Response:**")
                            st.write(qa.get('spoken_response', qa.get('content', 'No response')))
                            
                            st.write("**Keywords:**")
                            st.write(", ".join(qa.get('keywords', [])) if qa.get('keywords') else "None")
                            
                            col1, col2 = st.columns(2)
                            with col1:
                                if st.button("🔊 Preview", key=f"preview_{qa['id']}"):
                                    try:
                                        audio_bytes = generate_speech_sync(qa.get('spoken_response', qa.get('content', '')), preview_voice_id)
                                        st.audio(audio_bytes, format="audio/mp3")
                                    except Exception as e:
                                        st.error(f"Preview failed: {e}")
                            with col2:
                                if st.button("🗑️ Delete", key=f"delete_{qa['id']}"):
                                    client.table('document_chunks').delete().eq('id', qa['id']).execute()
                                    st.success("Deleted!")
                                    st.rerun()
                else:
                    st.info("No Q&A pairs found. Create some in the 'Create Q&A' tab.")
            else:
                st.info("No knowledge base found for this agent. Crawl a website first.")
                
        except Exception as e:
            st.error(f"Failed to load Q&A pairs: {e}")

# Tab 4: Test Queries
with tab4:
    st.header("Test RAG Queries")
    
    if not st.session_state.selected_agent:
        st.warning("Please select an agent from the sidebar first.")
    else:
        test_query = st.text_input("Enter a test question", placeholder="What are your hours?")
        
        if st.button("🔍 Search", type="primary"):
            if test_query:
                with st.spinner("Searching..."):
                    try:
                        client = get_supabase_client()
                        result = find_best_answer(client, st.session_state.selected_agent, test_query)
                        
                        if result:
                            st.success("✅ Match found!")
                            
                            col1, col2 = st.columns([3, 1])
                            with col1:
                                st.write("**Matched Question:**")
                                st.write(result.get('question', 'N/A'))
                                
                                st.write("**Response:**")
                                st.info(result.get('spoken_response', result.get('content', 'No response')))
                            
                            with col2:
                                st.metric("Similarity", f"{result.get('similarity', 0):.2%}")
                            
                            # Play audio
                            if st.button("🔊 Play Response"):
                                audio_bytes = generate_speech_sync(
                                    result.get('spoken_response', result.get('content', '')),
                                    preview_voice_id
                                )
                                st.audio(audio_bytes, format="audio/mp3")
                        else:
                            st.warning("No matching Q&A found. The system would use a fallback response.")
                            
                    except Exception as e:
                        st.error(f"Search failed: {e}")
            else:
                st.warning("Please enter a question")

# Footer
st.markdown("---")
st.markdown("""
<div style="text-align: center; color: #666; padding: 1rem;">
    <p>🎙️ RAG Admin Tool - No LLM, Just Precision Retrieval</p>
    <p style="font-size: 0.8rem;">Responses are spoken exactly as stored. Quality in = Quality out.</p>
</div>
""", unsafe_allow_html=True)
