# Insert Linux Terminals (Shells) into Jupyter Notebooks

### Usage

With this plugin, you can insert terminal cells (shells) using a button added to your Jupyter toolbar.  You can remove them by just deleting the cell (it's a markdown cell the plugin modifies to instead display a terminal).

For any terminal cell, by adjusting the metadata for that cell, you can :

1. Set the number of lines of text displayed (and thereby, height of the cell)
1. Set an initial command to run when the terminal is opened.

Any terminal cell can be "Reset" which destroys that shell and creates a new cell, via a link under the cell.

The shells `pwd` is set to the directory containing the current notebook.

Each terminal is by default a separate bash shell, but you can also
have all terminals in a notebook use the same shell.  (As you type you
will see your input appearing in all terminals at once.)

If you don't have the plugin installed, then terminal cells will
appear as markdown cells with an explanatory message on how to install
the plugin in them. When you distribute notebooks with the terminal
cells, the recipient will also need to install the plugin to see and
use them.

### Installation

Install the plugin with :

`pip install jupyterterminals`

or

`conda install -c willkessler jupyterterminals`

### Related Software

Inlined Terminals are included by default in Jupyter Graffiti, which
also allows you to add popup tips to any text in your notebook, and
create interactive screen recordings to help you teach topics using
Jupyter Notebooks.

Take a look at Jupyter Graffiti to learn more about what it can do for
you!

(Do not use Jupyter Terminals and Jupyter Graffiti at the same time: they will conflict.)

