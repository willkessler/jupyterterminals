# Insert Linux Terminals (Shells) into Jupyter Notebooks

### Usage

With this plugin, you can insert terminal cells (shells) using a button added to your Jupyter toolbar.

For any terminal cell, by editing the metadata for that cell, you can :

1. Set the number of lines of text displayed (and thereby, height of the cell)
1. Set an initial command to run when the terminal is opened.

Any terminal cell can be "Reset" which destroys that shell and creates a new cell, via a link under the cell.

The shells `pwd` is set to the directory containing the current
notebook. If you click the "Jump to Notebook's Dir" link you can make the
terminal go back to the directory where the notebook is located.

If the terminal locks up somehow, just click the "Reset" link to get a
new Terminal in that cell.

You can remove Terminal cells by just deleting them.

Each terminal cell is connected to a separate bash shell. You can see
these terminals in Jupyter's "Running" tab.  If you reload the
notebook, you will connect to the same Jupyter terminals you loaded
earlier, with their history intact (although you may not see the
previous output in that terminal).  If you delete a terminal cell, the
Jupyter terminal will continue to live for the life of the server
until you shut it down from the "Running" tab.

If you don't have the plugin installed, then terminal cells will
appear as markdown cells with an explanatory message on how to install
the plugin in them. When you distribute notebooks with Jupyter
Terminals, the recipient will also need to install the plugin to see
(and use) them.


### Installation

Install the plugin with :

`pip install jupyterterminals`

or

`conda install -c willkessler jupyterterminals`

### Limitations

This plugin has not been configured to work on Windows systems running Jupyter.
This is planned for a future release, however.

### Related Software

Inlined Terminals are included by default in Jupyter Graffiti, which
also allows you to add popup tips to any text in your notebook, and
create interactive screen recordings to help you teach topics using
Jupyter Notebooks.

Take a look at Jupyter Graffiti to learn more about what it can do for
you!

(Do not use Jupyter Terminals and Jupyter Graffiti at the same time: they will conflict.)
