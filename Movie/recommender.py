import pandas as pd

movies         = pd.read_csv("data/movielens/movies.csv")
movies_onehot  = pd.read_csv("data/movielens/movies_onehot.csv")
ratings        = pd.read_csv("data/movielens/ratings.csv")
users          = pd.read_csv("data/movielens/users.csv")

print(movies.shape, ratings.shape, users.shape, movies_onehot.shape)
