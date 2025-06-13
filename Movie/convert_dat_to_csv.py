import pandas as pd
import os

RAW = "data/movielens/raw"
OUT  = "data/movielens"

# make sure output dir exists
os.makedirs(OUT, exist_ok=True)

# load raw .dat files (latin-1 handles special chars)
movies  = pd.read_csv(f"{RAW}/movies.dat",  sep="::", engine="python",
                      names=["movieId","title","genres"], encoding="latin-1")
ratings = pd.read_csv(f"{RAW}/ratings.dat", sep="::", engine="python",
                      names=["userId","movieId","rating","timestamp"], encoding="latin-1")
users   = pd.read_csv(f"{RAW}/users.dat",   sep="::", engine="python",
                      names=["userId","gender","age","occupation","zip_code"], encoding="latin-1")

# save as CSVs
movies .to_csv(f"{OUT}/movies.csv",       index=False)
ratings.to_csv(f"{OUT}/ratings.csv",      index=False)
users  .to_csv(f"{OUT}/users.csv",        index=False)

# also create the one-hot genre file
genre_dummies = movies["genres"].str.get_dummies(sep="|")
movies_onehot = pd.concat([movies[["movieId","title"]], genre_dummies], axis=1)
movies_onehot.to_csv(f"{OUT}/movies_onehot.csv", index=False)

print("Conversion complete! CSVs are in data/movielens/")
