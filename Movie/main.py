onboarding_titles = ["Toy Story (1995)", "Titanic (1997)", ]  # ~10 titles
for title in onboarding_titles:
    rating = st.slider(f"How much did you like {title}?", 1, 5, 3)
    store_rating(user_id, title, rating)
