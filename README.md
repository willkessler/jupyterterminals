## Create cells containing Linux shells in cells in your Jupyter Notebooks

### Usage

You can insert terminal cells using a button added to your Jupyter toolbar.  You can remove them by just deleting the cell (it's a markdown cell the plugin modifies to instead display a terminal).

For any terminal cell, using the metadata for that cell, you can :
1. Set the number of lines of text displayed (and thereby, height of the cell)
1. Set an initial command to run when the terminal is opened.

Any terminal cell can be "Reset" which destroys that shell and creates a new cell, via a link under the cell.

The shells `pwd` is set to the directory containing the current notebook.

Each terminal is by default a separate bash shell, but you can also have two terminals using the same shell.

If you don't have the plugin installed, then terminal cells will appear as markdown cells with an explanatory message on how to install the plugin in them. When you distribute notebooks with the terminal cells, the recipient will also need to install the plugin to see and use them.

### Installation

Install the plugin with :

`pip install jupyterterminals`

or

`conda install -c willkessler jupyterterminals`

### Related Software

Jupyter Terminals are included by default in Jupyter Graffiti, which allows you to also add popup tips to any text in your notebook and create interactive screen recordings to help you teach topics using Jupyter Notebooks.  While you can install both Jupyter Terminals and Jupyter Graffiti at one time, it's not advised; use one or the other.  Take a look at Jupyter Graffiti to learn more about what it can do for you!


