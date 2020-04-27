FROM jupyter/datascience-notebook

USER root
RUN curl -sL https://deb.nodesource.com/setup_13.x | sudo bash - && apt-get install -y nodejs

RUN pip install jupyterterminals
RUN pip install nbzip
RUN jupyter serverextension enable --py nbzip --sys-prefix
RUN jupyter nbextension install --py nbzip
RUN jupyter nbextension enable --py nbzip

# Switch back to where we'll mount $PWD when we start up this container
USER jovyan
RUN mkdir -p /home/jovyan/work
WORKDIR /home/jovyan/work


# Build commands (for reference):
# docker build . -t jupyterterminals
# docker run --rm -p 8888:8888 -e JUPYTER_LAB_ENABLE=yes -v "$PWD":/home/jovyan jupytergraffiti
# Build bundle (for reference):
# RUN cd /opt/jupyterterminals && npm install && npm run build && \
#       jupyter nbextension install terminals-dist && jupyter nbextension enable terminals-dist/terminals

